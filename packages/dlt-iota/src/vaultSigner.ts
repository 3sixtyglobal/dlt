// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Signer, type SignatureScheme } from "@iota/iota-sdk/cryptography";
import { Ed25519PublicKey } from "@iota/iota-sdk/keypairs/ed25519";
import type { IVaultConnector } from "@twin.org/vault-models";

/**
 * A signer that delegates all signing to the vault connector, ensuring the private key
 * is never exposed to application code.
 */
export class VaultSigner extends Signer {
	/**
	 * The vault connector used to perform signing.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The vault key name to use when signing.
	 * @internal
	 */
	private readonly _keyName: string;

	/**
	 * The public key for this signer.
	 * @internal
	 */
	private readonly _publicKey: Ed25519PublicKey;

	/**
	 * Create a new VaultSigner.
	 * @param vaultConnector The vault connector used to perform signing operations.
	 * @param keyName The name of the key in the vault to use for signing.
	 * @param publicKey The public key bytes corresponding to the vault key.
	 */
	constructor(vaultConnector: IVaultConnector, keyName: string, publicKey: Uint8Array) {
		super();
		this._vaultConnector = vaultConnector;
		this._keyName = keyName;
		this._publicKey = new Ed25519PublicKey(publicKey);
	}

	/**
	 * Get the key scheme.
	 * @returns The signature scheme.
	 */
	public getKeyScheme(): SignatureScheme {
		return "ED25519";
	}

	/**
	 * Get the public key.
	 * @returns The Ed25519 public key.
	 */
	public getPublicKey(): Ed25519PublicKey {
		return this._publicKey;
	}

	/**
	 * Sign the provided bytes via the vault connector.
	 * @param bytes The bytes to sign.
	 * @returns The raw Ed25519 signature bytes.
	 */
	public async sign(bytes: Uint8Array): Promise<Uint8Array> {
		return this._vaultConnector.sign(this._keyName, bytes);
	}
}
