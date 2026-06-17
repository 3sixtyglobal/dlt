// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Signer, toSerializedSignature, type PublicKey } from "@iota/iota-sdk/cryptography";
import { Ed25519PublicKey } from "@iota/iota-sdk/keypairs/ed25519";
import type { IVaultConnector } from "@twin.org/vault-models";
import type { ITransactionSigner } from "./models/ITransactionSigner.js";

/**
 * A transaction signer that delegates all signing operations to the vault connector,
 * ensuring the private key is never exposed to application code.
 */
export class VaultTransactionSigner implements ITransactionSigner {
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
	 * Create a new VaultTransactionSigner.
	 * @param vaultConnector The vault connector used to perform signing operations.
	 * @param keyName The name of the key in the vault to use for signing.
	 * @param publicKey The public key bytes corresponding to the vault key.
	 */
	constructor(vaultConnector: IVaultConnector, keyName: string, publicKey: Uint8Array) {
		this._vaultConnector = vaultConnector;
		this._keyName = keyName;
		this._publicKey = new Ed25519PublicKey(publicKey);
	}

	/**
	 * Sign the BCS-encoded transaction data.
	 * Applies the TransactionData intent, hashes the result, signs via the vault,
	 * and returns a serialized IOTA signature string.
	 * @param txDataBcs The raw transaction bytes to sign.
	 * @returns The serialized signature string.
	 */
	public async sign(txDataBcs: Uint8Array): Promise<string> {
		const digest = Signer.signingDigest(txDataBcs, "TransactionData");
		const rawSignature = await this._vaultConnector.sign(this._keyName, digest);
		return toSerializedSignature({
			signature: rawSignature,
			signatureScheme: "ED25519",
			publicKey: this._publicKey
		});
	}

	/**
	 * Get the public key for this signer.
	 * @returns The Ed25519 public key.
	 */
	public async publicKey(): Promise<PublicKey> {
		return this._publicKey;
	}

	/**
	 * Get the IOTA-formatted public key bytes (scheme flag byte followed by the raw key bytes).
	 * @returns The IOTA public key bytes.
	 */
	public async iotaPublicKeyBytes(): Promise<Uint8Array> {
		return this._publicKey.toIotaBytes();
	}

	/**
	 * Get the vault key name used by this signer.
	 * @returns The key name.
	 */
	public keyId(): string {
		return this._keyName;
	}
}
