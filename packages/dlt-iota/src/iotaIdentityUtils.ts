// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	IdentityClient,
	IdentityClientReadOnly,
	OnChainIdentity
} from "@iota/identity-wasm/node/index.js";
import type { IotaClient } from "@iota/iota-sdk/client";
import type { PublicKey } from "@iota/iota-sdk/cryptography";
import { Ed25519PublicKey } from "@iota/iota-sdk/keypairs/ed25519";
import { GeneralError, Guards, Is, NotFoundError } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import { Iota } from "./iota.js";
import type { IIotaControllerCapInfo } from "./models/IIotaControllerCapInfo.js";

/**
 * Utility class for resolving IOTA Identity on-chain objects required by
 * the NFT mint_with_identity() Move contract function.
 */
export class IotaIdentityUtils {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IotaIdentityUtils>();

	/**
	 * Resolve the on-chain object IDs for an identity and its controller token.
	 * Returns the IDs needed to call mint_with_identity() on the NFT Move contract.
	 * @param identityId The DID of the identity (e.g. "did:iota:testnet:0x...").
	 * @param controllerAddress The on-chain address of the controller wallet.
	 * @param client The IOTA client instance.
	 * @returns The identity object ID and controller token object ID.
	 * @throws NotFoundError if the identity does not exist on-chain.
	 * @throws GeneralError if the identity has been deleted or the controller token is not found.
	 */
	public static async getControllerCapInfo(
		identityId: string,
		controllerAddress: string,
		client: IotaClient
	): Promise<IIotaControllerCapInfo> {
		Guards.stringValue(IotaIdentityUtils.CLASS_NAME, nameof(identityId), identityId);
		Guards.stringValue(IotaIdentityUtils.CLASS_NAME, nameof(controllerAddress), controllerAddress);

		// Extract the Object ID from the DID — last colon-delimited segment, prefixed with 0x.
		// IOTA DIDs have the format did:iota:<network>:<hex> where <hex> has no 0x prefix.
		const idParts = identityId.split(":");
		const identityObjectId = `0x${idParts[idParts.length - 1]}`;

		let onChain: OnChainIdentity | undefined;
		let controllerToken: Awaited<ReturnType<OnChainIdentity["getControllerTokenForAddress"]>>;

		try {
			// Both are IotaClient@1.11.0 but TypeScript resolves them from different module
			// entry points (dist/esm vs dist/cjs). The protected `transport` field causes a
			// class-compatibility failure even though the runtime types are identical.
			// Casting through the function's own parameter type keeps this refactor-safe.
			const identityClientReadOnly = await IdentityClientReadOnly.create(
				client as unknown as Parameters<(typeof IdentityClientReadOnly)["create"]>[0]
			);

			// getControllerTokenForAddress requires IdentityClient even though the operation is
			// read-only — the signer is never called, only the embedded CoreClientReadOnly is
			// used. TransactionSigner is a structural interface, so a minimal object literal
			// that satisfies its shape avoids importing the heavyweight JWK store machinery.
			const noOpSigner = {
				sign: async (_txData: Uint8Array): Promise<string> => {
					throw new GeneralError(IotaIdentityUtils.CLASS_NAME, "unexpectedSignerCall", undefined);
				},
				publicKey: async (): Promise<PublicKey> => new Ed25519PublicKey(new Uint8Array(32)),
				iotaPublicKeyBytes: async (): Promise<Uint8Array> => new Uint8Array(32),
				keyId: (): string => ""
			};
			const identityClient = await IdentityClient.create(identityClientReadOnly, noOpSigner);

			onChain = await OnChainIdentity.getById(identityObjectId, identityClient);
			if (!Is.undefined(onChain) && !onChain.hasDeletedDid()) {
				controllerToken = await onChain.getControllerTokenForAddress(
					controllerAddress,
					identityClient
				);
			}
		} catch (error) {
			throw new GeneralError(
				IotaIdentityUtils.CLASS_NAME,
				"getControllerCapInfoFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}

		if (Is.undefined(onChain)) {
			throw new NotFoundError(IotaIdentityUtils.CLASS_NAME, "identityNotFound", identityId);
		}

		if (onChain.hasDeletedDid()) {
			throw new GeneralError(IotaIdentityUtils.CLASS_NAME, "identityDeleted", { identityId });
		}

		if (Is.undefined(controllerToken)) {
			throw new NotFoundError(IotaIdentityUtils.CLASS_NAME, "controllerTokenNotFound", identityId);
		}

		return {
			identityObjectId,
			controllerCapObjectId: controllerToken.id()
		};
	}
}
