// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Base64Url, Guards } from "@3sixty/core";
import { nameof } from "@3sixty/nameof";
import type { IVaultConnector } from "@3sixty/vault-models";
import {
	Jwk,
	JwkType,
	JwsAlgorithm,
	KeyIdMemStore,
	Storage,
	StorageSigner
} from "@iota/identity-wasm/node/index.js";
import { Iota } from "./iota.js";
import type { IIotaConfig } from "./models/IIotaConfig.js";
import { VaultJwkStorage } from "./vaultJwkStorage.js";

/**
 * Factory that creates a vault-backed StorageSigner for IOTA Identity operations.
 * The private key never leaves the vault - only the raw signing operation is delegated.
 *
 * The returned StorageSigner is a genuine WASM object, satisfying the internal validation
 * that IdentityClient.create() performs on the signer's iotaPublicKeyBytes() path.
 */
export class VaultJwtSigner {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<VaultJwtSigner>();

	/**
	 * Create a StorageSigner whose cryptographic operations are backed by the vault connector.
	 * @param vaultConnector The vault connector.
	 * @param config The configuration.
	 * @param identity The identity of the user to access the vault keys.
	 * @param accountIndex The account index.
	 * @param addressIndex The address index within the account.
	 * @returns A StorageSigner backed by the vault for the specified key.
	 */
	public static async create(
		vaultConnector: IVaultConnector,
		config: IIotaConfig,
		identity: string,
		accountIndex: number,
		addressIndex: number
	): Promise<StorageSigner> {
		Guards.object(VaultJwtSigner.CLASS_NAME, nameof(vaultConnector), vaultConnector);
		Guards.object<IIotaConfig>(VaultJwtSigner.CLASS_NAME, nameof(config), config);
		Guards.stringValue(VaultJwtSigner.CLASS_NAME, nameof(identity), identity);
		Guards.integer(VaultJwtSigner.CLASS_NAME, nameof(accountIndex), accountIndex);
		Guards.integer(VaultJwtSigner.CLASS_NAME, nameof(addressIndex), addressIndex);

		const transactionSigner = await Iota.getTransactionSigner(
			vaultConnector,
			config,
			identity,
			accountIndex,
			addressIndex
		);

		const keyName = transactionSigner.keyId();
		const publicKey = await transactionSigner.publicKey();

		const publicJwk = new Jwk({
			kty: JwkType.Okp,
			crv: "Ed25519",
			alg: JwsAlgorithm.EdDSA,
			x: Base64Url.encode(publicKey.toRawBytes())
		});

		const vaultJwkStorage = new VaultJwkStorage(vaultConnector, keyName);
		const keyId = await vaultJwkStorage.insert(publicJwk);
		const storage = new Storage(vaultJwkStorage, new KeyIdMemStore());

		return new StorageSigner(storage, keyId, publicJwk);
	}
}
