// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	IdentityClient,
	IdentityClientReadOnly,
	Jwk,
	JwkMemStore,
	JwkType,
	JwsAlgorithm,
	KeyIdMemStore,
	OnChainIdentity,
	Storage,
	StorageSigner
} from "@iota/identity-wasm/node/index.js";
import { decodeIotaPrivateKey } from "@iota/iota-sdk/cryptography";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Base64Url, GeneralError, Guards, Is, NotFoundError } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import { Iota } from "./iota.js";
import type { IIotaClient } from "./models/IIotaClient.js";
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
		client: IIotaClient
	): Promise<IIotaControllerCapInfo> {
		Guards.stringValue(IotaIdentityUtils.CLASS_NAME, nameof(identityId), identityId);
		Guards.stringValue(IotaIdentityUtils.CLASS_NAME, nameof(controllerAddress), controllerAddress);
		Guards.object(IotaIdentityUtils.CLASS_NAME, nameof(client), client);

		// Extract the Object ID from the DID — last colon-delimited segment.
		// On-chain DIDs include the 0x prefix in the segment; the check avoids double-prefixing.
		const idParts = identityId.split(":");
		const lastSegment = idParts[idParts.length - 1];
		const identityObjectId = lastSegment.startsWith("0x") ? lastSegment : `0x${lastSegment}`;

		let onChain: OnChainIdentity | undefined;
		let controllerToken: Awaited<ReturnType<OnChainIdentity["getControllerTokenForAddress"]>>;

		try {
			// IIotaClient and the IotaClient expected by identity-wasm resolve from different
			// module entry points (dist/esm vs dist/cjs). The protected `transport` field causes
			// a structural incompatibility even though the runtime types are identical.
			const identityClientReadOnly = await IdentityClientReadOnly.create(
				client as unknown as Parameters<(typeof IdentityClientReadOnly)["create"]>[0]
			);

			// getControllerTokenForAddress requires IdentityClient even though the operation
			// is read-only — the signer is never called, only the embedded read-only client.
			// StorageSigner is used (rather than a plain object satisfying TransactionSigner
			// structurally) because IdentityClient.create() validates iotaPublicKeyBytes()
			// through an internal WASM code path that only accepts bytes from the library's
			// own signer implementations. Plain JS objects fail with "Unsupported curve"
			// even for valid Ed25519 keys because they take a different callback path.
			const noOpKeypair = new Ed25519Keypair();
			const rawPublic = noOpKeypair.getPublicKey().toRawBytes();
			const { secretKey: rawPrivate } = decodeIotaPrivateKey(noOpKeypair.getSecretKey());
			const noOpSigner = new StorageSigner(
				new Storage(new JwkMemStore(), new KeyIdMemStore()),
				"",
				new Jwk({
					kty: JwkType.Okp,
					crv: "Ed25519",
					alg: JwsAlgorithm.EdDSA,
					x: Base64Url.encode(rawPublic),
					d: Base64Url.encode(rawPrivate)
				})
			);
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
