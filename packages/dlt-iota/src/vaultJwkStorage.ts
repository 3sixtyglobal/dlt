// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { Jwk, JwkStorage, JwsAlgorithm } from "@iota/identity-wasm/node/index.js";
import { GeneralError } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import type { IVaultConnector } from "@twin.org/vault-models";

/**
 * JwkStorage implementation that delegates the sign operation to the vault connector,
 * keeping the private key inside the vault at all times.
 */
export class VaultJwkStorage implements JwkStorage {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<VaultJwkStorage>();

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
	 * Create a new VaultJwkStorage.
	 * @param vaultConnector The vault connector used to perform signing operations.
	 * @param keyName The name of the key in the vault to use for signing.
	 */
	constructor(vaultConnector: IVaultConnector, keyName: string) {
		this._vaultConnector = vaultConnector;
		this._keyName = keyName;
	}

	/**
	 * Sign data by delegating to the vault connector.
	 * @param keyId The key identifier (unused; the vault key name is used directly).
	 * @param data The data to sign.
	 * @param publicKey The public key JWK (unused; the vault connector handles key lookup).
	 * @returns The raw signature bytes.
	 */
	public async sign(keyId: string, data: Uint8Array, publicKey: Jwk): Promise<Uint8Array> {
		return this._vaultConnector.sign(this._keyName, data);
	}

	/**
	 * Accept a JWK entry and return the vault key name as the stable key identifier.
	 * @param jwk The JWK to register.
	 * @returns The key identifier.
	 */
	public async insert(jwk: Jwk): Promise<string> {
		return this._keyName;
	}

	/**
	 * Check whether the given key identifier is managed by this storage.
	 * @param keyId The key identifier to check.
	 * @returns True if the key exists in this storage.
	 */
	public async exists(keyId: string): Promise<boolean> {
		return keyId === this._keyName;
	}

	/**
	 * Key generation is not supported; keys are managed entirely by the vault.
	 * @param keyType The key type requested.
	 * @param algorithm The JWS algorithm requested.
	 * @returns Never returns.
	 */
	public async generate(keyType: string, algorithm: JwsAlgorithm): Promise<never> {
		throw new GeneralError(VaultJwkStorage.CLASS_NAME, "generateNotSupported");
	}

	/**
	 * Deletion is a no-op; keys are managed by the vault.
	 * @param keyId The key identifier to delete.
	 */
	public async delete(keyId: string): Promise<void> {}
}
