// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { PublicKey } from "@iota/iota-sdk/cryptography";

/**
 * Interface for a transaction signer backed by a secure key store.
 */
export interface ITransactionSigner {
	/**
	 * Sign the BCS-encoded transaction data and return a serialized IOTA signature string.
	 * @param txDataBcs The raw transaction bytes to sign.
	 * @returns The serialized signature string (scheme flag + signature + public key, base64-encoded).
	 */
	sign(txDataBcs: Uint8Array): Promise<string>;

	/**
	 * Get the public key for this signer.
	 * @returns The public key.
	 */
	publicKey(): Promise<PublicKey>;

	/**
	 * Get the IOTA-formatted public key bytes (scheme flag byte followed by the raw key bytes).
	 * @returns The IOTA public key bytes.
	 */
	iotaPublicKeyBytes(): Promise<Uint8Array>;

	/**
	 * Get the key identifier for this signer.
	 * @returns The key identifier.
	 */
	keyId(): string;
}
