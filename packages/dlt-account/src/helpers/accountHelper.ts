// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, GeneralError, Guards, Is } from "@3sixty/core";
import { Bip39, Bip44, Blake2b, KeyType } from "@3sixty/crypto";
import { nameof } from "@3sixty/nameof";
import type { IVaultConnector } from "@3sixty/vault-models";
import { VaultConnectorHelper, VaultKeyType } from "@3sixty/vault-models";
import type { IAccountConfig } from "../models/IAccountConfig.js";

/**
 * Helper class for account management operations.
 */
export class AccountHelper {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<AccountHelper>();

	/**
	 * Default name for the mnemonic secret.
	 */
	public static readonly DEFAULT_MNEMONIC_SECRET_NAME: string = "mnemonic";

	/**
	 * Default name for the seed secret.
	 */
	public static readonly DEFAULT_SEED_SECRET_NAME: string = "seed";

	/**
	 * Default coin type.
	 */
	public static readonly DEFAULT_COIN_TYPE: number = 4218;

	/**
	 * Default pre-calculation chunk size.
	 */
	public static readonly DEFAULT_CALC_CHUNK_SIZE: number = 25;

	/**
	 * Default scan range.
	 */
	public static readonly DEFAULT_SCAN_RANGE_SIZE: number = 1000;

	/**
	 * Create a new account by generating a mnemonic and seed, storing them in the vault, and pre-caching the first chunk of derived keys.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param mnemonic The mnemonic to store, if undefined a new one will be generated and returned.
	 * @param accountIndex The account index to pre-cache.
	 * @returns The mnemonic that was stored.
	 */
	public static async createAccountKeys(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		identity: string,
		mnemonic?: string,
		accountIndex?: number
	): Promise<string> {
		Guards.object(AccountHelper.CLASS_NAME, nameof(vaultConnector), vaultConnector);
		Guards.stringValue(AccountHelper.CLASS_NAME, nameof(identity), identity);

		const mnemonicToStore = mnemonic ?? Bip39.randomMnemonic();

		await vaultConnector.setSecret(
			AccountHelper.buildMnemonicKey(identity, accountConfig?.vaultMnemonicId),
			mnemonicToStore
		);

		const seed = Bip39.mnemonicToSeed(mnemonicToStore);
		await vaultConnector.setSecret(
			AccountHelper.buildSeedKey(identity, accountConfig?.vaultSeedId),
			Converter.bytesToBase64(seed)
		);

		await AccountHelper.getPublicKeys(
			accountConfig,
			vaultConnector,
			identity,
			accountIndex ?? 0,
			false,
			0,
			async () => seed
		);

		return mnemonicToStore;
	}

	/**
	 * Rename all vault entries for an account from one identity to another.
	 * The account indexes are scanned from 0 until one has no keys, an account index beyond a gap
	 * in that sequence is only found when it is passed explicitly.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector.
	 * @param fromIdentity The source identity whose vault entries should be copied.
	 * @param toIdentity The destination identity that will receive the copied entries.
	 * @param accountIndex An account index whose keys are also renamed, such as the one the keys were created for.
	 */
	public static async renameAccountKeys(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		fromIdentity: string,
		toIdentity: string,
		accountIndex?: number
	): Promise<void> {
		Guards.object(AccountHelper.CLASS_NAME, nameof(vaultConnector), vaultConnector);
		Guards.stringValue(AccountHelper.CLASS_NAME, nameof(fromIdentity), fromIdentity);
		Guards.stringValue(AccountHelper.CLASS_NAME, nameof(toIdentity), toIdentity);
		if (!Is.undefined(accountIndex)) {
			Guards.integer(AccountHelper.CLASS_NAME, nameof(accountIndex), accountIndex);
		}

		if (fromIdentity === toIdentity) {
			return;
		}

		const mnemonicKey = AccountHelper.buildMnemonicKey(
			fromIdentity,
			accountConfig?.vaultMnemonicId
		);
		const mnemonic = await vaultConnector.getSecret<string>(mnemonicKey);
		await vaultConnector.setSecret(
			AccountHelper.buildMnemonicKey(toIdentity, accountConfig?.vaultMnemonicId),
			mnemonic
		);
		await vaultConnector.removeSecret(mnemonicKey);

		try {
			const seedKey = AccountHelper.buildSeedKey(fromIdentity, accountConfig?.vaultSeedId);
			const seed = await vaultConnector.getSecret<string>(seedKey);
			await vaultConnector.setSecret(
				AccountHelper.buildSeedKey(toIdentity, accountConfig?.vaultSeedId),
				seed
			);
			await vaultConnector.removeSecret(seedKey);
		} catch {}

		const rename = async (index: number, internal: boolean, addressIndex: number): Promise<void> =>
			vaultConnector.renameKey(
				AccountHelper.buildAddressKeyName(fromIdentity, index, internal, addressIndex),
				AccountHelper.buildAddressKeyName(toIdentity, index, internal, addressIndex)
			);

		let scanIndex = 0;
		while (
			await AccountHelper.processAccountIndexKeys(vaultConnector, fromIdentity, scanIndex, rename)
		) {
			scanIndex++;
		}

		if (!Is.undefined(accountIndex) && accountIndex > scanIndex) {
			await AccountHelper.processAccountIndexKeys(
				vaultConnector,
				fromIdentity,
				accountIndex,
				rename
			);
		}
	}

	/**
	 * Remove all vault entries for an account.
	 * The account indexes are scanned from 0 until one has no keys, an account index beyond a gap
	 * in that sequence is only found when it is passed explicitly.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user whose vault keys should be removed.
	 * @param accountIndex An account index whose keys are also removed, such as the one the keys were created for.
	 */
	public static async removeAccountKeys(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		identity: string,
		accountIndex?: number
	): Promise<void> {
		Guards.object(AccountHelper.CLASS_NAME, nameof(vaultConnector), vaultConnector);
		Guards.stringValue(AccountHelper.CLASS_NAME, nameof(identity), identity);
		if (!Is.undefined(accountIndex)) {
			Guards.integer(AccountHelper.CLASS_NAME, nameof(accountIndex), accountIndex);
		}

		const remove = async (index: number, internal: boolean, addressIndex: number): Promise<void> =>
			vaultConnector.removeKey(
				AccountHelper.buildAddressKeyName(identity, index, internal, addressIndex)
			);

		let scanIndex = 0;
		while (
			await AccountHelper.processAccountIndexKeys(vaultConnector, identity, scanIndex, remove)
		) {
			scanIndex++;
		}

		if (!Is.undefined(accountIndex) && accountIndex > scanIndex) {
			await AccountHelper.processAccountIndexKeys(vaultConnector, identity, accountIndex, remove);
		}

		try {
			await vaultConnector.removeSecret(
				AccountHelper.buildSeedKey(identity, accountConfig?.vaultSeedId)
			);
		} catch {}
		try {
			await vaultConnector.removeSecret(
				AccountHelper.buildMnemonicKey(identity, accountConfig?.vaultMnemonicId)
			);
		} catch {}
	}

	/**
	 * Get the key for storing the seed.
	 * @param identity The identity to use.
	 * @param vaultSeedId The seed ID to use.
	 * @returns The seed key.
	 */
	public static buildSeedKey(identity: string, vaultSeedId?: string): string {
		return VaultConnectorHelper.buildKeyName(
			identity,
			vaultSeedId ?? AccountHelper.DEFAULT_SEED_SECRET_NAME
		);
	}

	/**
	 * Get the key for storing the mnemonic.
	 * @param identity The identity to use.
	 * @param vaultMnemonicId The mnemonic ID to use.
	 * @returns The mnemonic key.
	 */
	public static buildMnemonicKey(identity: string, vaultMnemonicId?: string): string {
		return VaultConnectorHelper.buildKeyName(
			identity,
			vaultMnemonicId ?? AccountHelper.DEFAULT_MNEMONIC_SECRET_NAME
		);
	}

	/**
	 * Ensure a range of BIP44-derived keys are registered as individual vault keys and return their public keys.
	 * If the first key of the range already exists the range is considered registered and only public keys are derived.
	 * If not registered, all keys are derived and added to the vault before returning the public keys.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @param accountIndex The account index.
	 * @param internal Whether the addresses are internal or external.
	 * @param addressIndex Any address index within the desired chunk; aligned internally.
	 * @param seedProvider Callback invoked at most once per call to supply the seed when a chunk is not yet registered.
	 * @returns The base64-encoded public keys for each address in the range.
	 */
	public static async getPublicKeys(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		identity: string,
		accountIndex: number,
		internal: boolean,
		addressIndex: number,
		seedProvider: () => Promise<Uint8Array>
	): Promise<string[]> {
		const chunkStart = addressIndex - (addressIndex % AccountHelper.DEFAULT_CALC_CHUNK_SIZE);
		const firstKeyName = AccountHelper.buildAddressKeyName(
			identity,
			accountIndex,
			internal,
			chunkStart
		);
		const publicKeys: string[] = [];

		if (await vaultConnector.keyExists(firstKeyName)) {
			for (let i = chunkStart; i < chunkStart + AccountHelper.DEFAULT_CALC_CHUNK_SIZE; i++) {
				const keyName = AccountHelper.buildAddressKeyName(identity, accountIndex, internal, i);
				const keyData = await vaultConnector.getKey(keyName, "public");
				if (!keyData.publicKey) {
					throw new GeneralError(AccountHelper.CLASS_NAME, "missingPublicKey", { keyName });
				}
				publicKeys.push(Converter.bytesToBase64(keyData.publicKey));
			}
		} else {
			const seed = await seedProvider();
			const coinType = accountConfig?.coinType ?? AccountHelper.DEFAULT_COIN_TYPE;

			for (let i = chunkStart; i < chunkStart + AccountHelper.DEFAULT_CALC_CHUNK_SIZE; i++) {
				const keyName = AccountHelper.buildAddressKeyName(identity, accountIndex, internal, i);
				const keyPair = Bip44.keyPair(seed, KeyType.Ed25519, coinType, accountIndex, internal, i);
				await vaultConnector.addKey(
					keyName,
					VaultKeyType.Ed25519,
					keyPair.privateKey,
					keyPair.publicKey
				);
				publicKeys.push(Converter.bytesToBase64(keyPair.publicKey));
			}
		}

		return publicKeys;
	}

	/**
	 * Build the vault key name for a specific derived address.
	 * @param identity The identity to use.
	 * @param accountIndex The account index.
	 * @param internal Whether the address is internal or external.
	 * @param addressIndex The address index.
	 * @returns The vault key name.
	 */
	public static buildAddressKeyName(
		identity: string,
		accountIndex: number,
		internal: boolean,
		addressIndex: number
	): string {
		return VaultConnectorHelper.buildKeyName(
			identity,
			"account",
			accountIndex.toString(),
			internal ? "1" : "0",
			`${addressIndex}`
		);
	}

	/**
	 * Get address for the identity.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param accountIndex The account index to get the addresses for.
	 * @param startAddressIndex The start index for the addresses.
	 * @param isInternal Whether the addresses are internal.
	 * @returns The address.
	 */
	public static async getAddress(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		identity: string,
		accountIndex: number,
		startAddressIndex: number,
		isInternal?: boolean
	): Promise<string> {
		const addresses = await AccountHelper.getAddresses(
			accountConfig,
			vaultConnector,
			identity,
			accountIndex,
			startAddressIndex,
			1,
			isInternal
		);
		return addresses[0];
	}

	/**
	 * Get addresses for the identity.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param accountIndex The account index to get the addresses for.
	 * @param startAddressIndex The start index for the addresses.
	 * @param count The number of addresses to generate.
	 * @param isInternal Whether the addresses are internal.
	 * @returns The list of addresses.
	 */
	public static async getAddresses(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		identity: string,
		accountIndex: number,
		startAddressIndex: number,
		count: number,
		isInternal?: boolean
	): Promise<string[]> {
		Guards.object(AccountHelper.CLASS_NAME, nameof(vaultConnector), vaultConnector);
		Guards.stringValue(AccountHelper.CLASS_NAME, nameof(identity), identity);
		Guards.integer(AccountHelper.CLASS_NAME, nameof(accountIndex), accountIndex);
		Guards.integer(AccountHelper.CLASS_NAME, nameof(startAddressIndex), startAddressIndex);
		Guards.integer(AccountHelper.CLASS_NAME, nameof(count), count);

		const addresses: string[] = [];
		const internal = isInternal ?? false;
		let currentIndex = startAddressIndex;
		let cachedSeed: Uint8Array | undefined;
		const seedProvider = async (): Promise<Uint8Array> => {
			cachedSeed ??= await AccountHelper.getSeed(accountConfig, vaultConnector, identity);
			return cachedSeed;
		};

		while (addresses.length < count) {
			const chunkStart =
				Math.floor(currentIndex / AccountHelper.DEFAULT_CALC_CHUNK_SIZE) *
				AccountHelper.DEFAULT_CALC_CHUNK_SIZE;
			const publicKeys = await AccountHelper.getPublicKeys(
				accountConfig,
				vaultConnector,
				identity,
				accountIndex,
				internal,
				chunkStart,
				seedProvider
			);
			const chunk = publicKeys.map((pk: string) =>
				AccountHelper.publicKeyToAddress(Converter.base64ToBytes(pk))
			);
			const offsetInChunk = currentIndex - chunkStart;
			const remaining = count - addresses.length;
			addresses.push(...chunk.slice(offsetInChunk, offsetInChunk + remaining));
			currentIndex = chunkStart + AccountHelper.DEFAULT_CALC_CHUNK_SIZE;
		}

		return addresses;
	}

	/**
	 * Get the seed from the vault, deriving it from the mnemonic if necessary.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @returns The seed bytes.
	 */
	public static async getSeed(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		identity: string
	): Promise<Uint8Array> {
		const seedKey = AccountHelper.buildSeedKey(identity, accountConfig?.vaultSeedId);

		try {
			const seedBase64 = await vaultConnector.getSecret<string>(seedKey);
			return Converter.base64ToBytes(seedBase64);
		} catch {}

		const mnemonic = await vaultConnector.getSecret<string>(
			AccountHelper.buildMnemonicKey(identity, accountConfig?.vaultMnemonicId)
		);

		// If the seed is not found but the mnemonic exists, derive the seed and store it for future use
		const seed = Bip39.mnemonicToSeed(mnemonic);
		await vaultConnector.setSecret(seedKey, Converter.bytesToBase64(seed));

		return seed;
	}

	/**
	 * Find the vault key name and public key for a specific address by scanning derived keys.
	 * @param accountConfig The account configuration.
	 * @param vaultConnector The vault connector to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @param address The owner address whose key should be located.
	 * @param accountIndex The account index to search.
	 * @returns The vault key name and the public key bytes.
	 */
	public static async findAddressKey(
		accountConfig: IAccountConfig | undefined,
		vaultConnector: IVaultConnector,
		identity: string,
		address: string,
		accountIndex: number = 0
	): Promise<{ keyName: string; publicKey: Uint8Array }> {
		const scanRange = accountConfig?.maxAddressScanRange ?? AccountHelper.DEFAULT_SCAN_RANGE_SIZE;
		let cachedSeed: Uint8Array | undefined;
		const seedProvider = async (): Promise<Uint8Array> => {
			cachedSeed ??= await AccountHelper.getSeed(accountConfig, vaultConnector, identity);
			return cachedSeed;
		};

		for (
			let chunkStart = 0;
			chunkStart < scanRange;
			chunkStart += AccountHelper.DEFAULT_CALC_CHUNK_SIZE
		) {
			const publicKeys = await AccountHelper.getPublicKeys(
				accountConfig,
				vaultConnector,
				identity,
				accountIndex,
				false,
				chunkStart,
				seedProvider
			);
			const matchIndex = publicKeys.findIndex(
				(pk: string) => AccountHelper.publicKeyToAddress(Converter.base64ToBytes(pk)) === address
			);
			if (matchIndex >= 0) {
				const addressIndex = chunkStart + matchIndex;
				return {
					keyName: AccountHelper.buildAddressKeyName(identity, accountIndex, false, addressIndex),
					publicKey: Converter.base64ToBytes(publicKeys[matchIndex])
				};
			}
		}

		throw new GeneralError(AccountHelper.CLASS_NAME, "addressNotFound", { address });
	}

	/**
	 * Derive an address from a public key.
	 * @param publicKey The public key to derive the address from.
	 * @returns The derived address.
	 */
	public static publicKeyToAddress(publicKey: Uint8Array): string {
		return Converter.bytesToHex(Blake2b.sum256(publicKey), true);
	}

	/**
	 * Apply an action to every registered address key of an account index, chunk by chunk.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity owning the keys.
	 * @param accountIndex The account index.
	 * @param action The action to apply to each address key.
	 * @returns True if the account index had any keys.
	 * @internal
	 */
	private static async processAccountIndexKeys(
		vaultConnector: IVaultConnector,
		identity: string,
		accountIndex: number,
		action: (accountIndex: number, internal: boolean, addressIndex: number) => Promise<void>
	): Promise<boolean> {
		let accountHasKeys = false;

		for (const internal of [false, true]) {
			for (let chunkStart = 0; ; chunkStart += AccountHelper.DEFAULT_CALC_CHUNK_SIZE) {
				const firstKeyName = AccountHelper.buildAddressKeyName(
					identity,
					accountIndex,
					internal,
					chunkStart
				);
				if (!(await vaultConnector.keyExists(firstKeyName))) {
					break;
				}
				accountHasKeys = true;
				for (let i = chunkStart; i < chunkStart + AccountHelper.DEFAULT_CALC_CHUNK_SIZE; i++) {
					await action(accountIndex, internal, i);
				}
			}
		}

		return accountHasKeys;
	}
}
