// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter } from "@3sixty/core";
import { Bip39, Bip44, Blake2b, KeyType } from "@3sixty/crypto";
import type { IVaultConnector } from "@3sixty/vault-models";
import { VaultKeyType } from "@3sixty/vault-models";
import { AccountHelper } from "../src/helpers/accountHelper.js";
import type { IAccountConfig } from "../src/models/IAccountConfig.js";

const TEST_MNEMONIC =
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_IDENTITY = "did:example:123456";
const TEST_IDENTITY_2 = "did:example:789012";

function createMockVaultConnector(): {
	connector: IVaultConnector;
	secrets: Map<string, unknown>;
	keys: Map<string, { type: unknown; privateKey: Uint8Array; publicKey: Uint8Array }>;
} {
	const secrets = new Map<string, unknown>();
	const keys = new Map<string, { type: unknown; privateKey: Uint8Array; publicKey: Uint8Array }>();

	const connector = {
		CLASS_NAME: "MockVaultConnector",
		setSecret: async <T>(name: string, data: T): Promise<void> => {
			secrets.set(name, data);
		},
		getSecret: async <T>(name: string): Promise<T> => {
			if (!secrets.has(name)) {
				throw new Error(`Secret not found: ${name}`);
			}
			return secrets.get(name) as T;
		},
		removeSecret: async (name: string): Promise<void> => {
			secrets.delete(name);
		},
		secretExists: async (name: string): Promise<boolean> => secrets.has(name),
		keyExists: async (name: string): Promise<boolean> => keys.has(name),
		addKey: async (
			name: string,
			type: unknown,
			privateKey: Uint8Array,
			publicKey: Uint8Array
		): Promise<void> => {
			keys.set(name, { type, privateKey, publicKey });
		},
		getKey: async (
			name: string
		): Promise<{ type: unknown; privateKey?: Uint8Array; publicKey?: Uint8Array }> => {
			const entry = keys.get(name);
			if (!entry) {
				throw new Error(`Key not found: ${name}`);
			}
			return entry;
		},
		getKeyType: async (name: string): Promise<unknown> => keys.get(name)?.type,
		renameKey: async (name: string, newName: string): Promise<void> => {
			const entry = keys.get(name);
			if (entry) {
				keys.set(newName, entry);
				keys.delete(name);
			}
		},
		removeKey: async (name: string): Promise<void> => {
			keys.delete(name);
		}
	} as unknown as IVaultConnector;

	return { connector, secrets, keys };
}

async function seedupAccount(connector: IVaultConnector, identity: string): Promise<void> {
	await AccountHelper.createAccountKeys(undefined, connector, identity, TEST_MNEMONIC, 0);
}

describe("AccountHelper", () => {
	describe("buildSeedKey", () => {
		test("returns identity/seed by default", () => {
			expect(AccountHelper.buildSeedKey(TEST_IDENTITY)).toBe(`${TEST_IDENTITY}/seed`);
		});

		test("uses custom vaultSeedId when provided", () => {
			expect(AccountHelper.buildSeedKey(TEST_IDENTITY, "custom-seed")).toBe(
				`${TEST_IDENTITY}/custom-seed`
			);
		});
	});

	describe("buildMnemonicKey", () => {
		test("returns identity/mnemonic by default", () => {
			expect(AccountHelper.buildMnemonicKey(TEST_IDENTITY)).toBe(`${TEST_IDENTITY}/mnemonic`);
		});

		test("uses custom vaultMnemonicId when provided", () => {
			expect(AccountHelper.buildMnemonicKey(TEST_IDENTITY, "my-mnemonic")).toBe(
				`${TEST_IDENTITY}/my-mnemonic`
			);
		});
	});

	describe("buildAddressKeyName", () => {
		test("builds external key name at index 0", () => {
			expect(AccountHelper.buildAddressKeyName(TEST_IDENTITY, 0, false, 0)).toBe(
				`${TEST_IDENTITY}/account/0/0/0`
			);
		});

		test("builds internal key name", () => {
			expect(AccountHelper.buildAddressKeyName(TEST_IDENTITY, 0, true, 5)).toBe(
				`${TEST_IDENTITY}/account/0/1/5`
			);
		});

		test("reflects account and address indices", () => {
			expect(AccountHelper.buildAddressKeyName(TEST_IDENTITY, 2, false, 10)).toBe(
				`${TEST_IDENTITY}/account/2/0/10`
			);
		});
	});

	describe("publicKeyToAddress", () => {
		test("returns a 0x-prefixed hex string", () => {
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			const keyPair = Bip44.keyPair(seed, KeyType.Ed25519, 4218, 0, false, 0);
			const address = AccountHelper.publicKeyToAddress(keyPair.publicKey);
			expect(address).toMatch(/^0x[0-9a-f]{64}$/);
		});

		test("produces a Blake2b-256 hash of the public key", () => {
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			const keyPair = Bip44.keyPair(seed, KeyType.Ed25519, 4218, 0, false, 0);
			const expected = Converter.bytesToHex(Blake2b.sum256(keyPair.publicKey), true);
			expect(AccountHelper.publicKeyToAddress(keyPair.publicKey)).toBe(expected);
		});

		test("different public keys produce different addresses", () => {
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			const kp0 = Bip44.keyPair(seed, KeyType.Ed25519, 4218, 0, false, 0);
			const kp1 = Bip44.keyPair(seed, KeyType.Ed25519, 4218, 0, false, 1);
			expect(AccountHelper.publicKeyToAddress(kp0.publicKey)).not.toBe(
				AccountHelper.publicKeyToAddress(kp1.publicKey)
			);
		});
	});

	describe("createAccountKeys", () => {
		test("throws when vault connector is undefined", async () => {
			await expect(
				AccountHelper.createAccountKeys(
					undefined,
					undefined as unknown as IVaultConnector,
					TEST_IDENTITY,
					TEST_MNEMONIC,
					0
				)
			).rejects.toThrow();
		});

		test("throws when identity is empty", async () => {
			const { connector } = createMockVaultConnector();
			await expect(
				AccountHelper.createAccountKeys(undefined, connector, "", TEST_MNEMONIC, 0)
			).rejects.toThrow();
		});

		test("stores the provided mnemonic and returns it", async () => {
			const { connector, secrets } = createMockVaultConnector();
			const result = await AccountHelper.createAccountKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				TEST_MNEMONIC,
				0
			);
			expect(result).toBe(TEST_MNEMONIC);
			expect(secrets.get(`${TEST_IDENTITY}/mnemonic`)).toBe(TEST_MNEMONIC);
		});

		test("generates a mnemonic when none is provided", async () => {
			const { connector, secrets } = createMockVaultConnector();
			const result = await AccountHelper.createAccountKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				undefined,
				0
			);
			expect(typeof result).toBe("string");
			expect(result.split(" ").length).toBeGreaterThanOrEqual(12);
			expect(secrets.get(`${TEST_IDENTITY}/mnemonic`)).toBe(result);
		});

		test("stores a base64-encoded seed derived from the mnemonic", async () => {
			const { connector, secrets } = createMockVaultConnector();
			await AccountHelper.createAccountKeys(undefined, connector, TEST_IDENTITY, TEST_MNEMONIC, 0);
			const storedSeed = secrets.get(`${TEST_IDENTITY}/seed`);
			expect(typeof storedSeed).toBe("string");
			expect(storedSeed).toMatch(/^[A-Za-z0-9+/]+=*$/);
		});

		test("pre-caches 25 external keys for account 0", async () => {
			const { connector, keys } = createMockVaultConnector();
			await AccountHelper.createAccountKeys(undefined, connector, TEST_IDENTITY, TEST_MNEMONIC, 0);
			expect(keys.size).toBe(25);
			for (let i = 0; i < 25; i++) {
				expect(keys.has(`${TEST_IDENTITY}/account/0/0/${i}`)).toBe(true);
			}
		});

		test("uses custom vault key names when provided", async () => {
			const { connector, secrets } = createMockVaultConnector();
			const config: IAccountConfig = { vaultMnemonicId: "my-mnemonic", vaultSeedId: "my-seed" };
			await AccountHelper.createAccountKeys(config, connector, TEST_IDENTITY, TEST_MNEMONIC, 0);
			expect(secrets.has(`${TEST_IDENTITY}/my-mnemonic`)).toBe(true);
			expect(secrets.has(`${TEST_IDENTITY}/my-seed`)).toBe(true);
		});

		test("uses specified accountIndex for pre-caching", async () => {
			const { connector, keys } = createMockVaultConnector();
			await AccountHelper.createAccountKeys(undefined, connector, TEST_IDENTITY, TEST_MNEMONIC, 1);
			expect(keys.size).toBe(25);
			for (let i = 0; i < 25; i++) {
				expect(keys.has(`${TEST_IDENTITY}/account/1/0/${i}`)).toBe(true);
			}
		});
	});

	describe("renameAccountKeys", () => {
		test("throws when vault connector is undefined", async () => {
			await expect(
				AccountHelper.renameAccountKeys(
					undefined,
					undefined as unknown as IVaultConnector,
					TEST_IDENTITY,
					TEST_IDENTITY_2
				)
			).rejects.toThrow();
		});

		test("throws when fromIdentity is empty", async () => {
			const { connector } = createMockVaultConnector();
			await expect(
				AccountHelper.renameAccountKeys(undefined, connector, "", TEST_IDENTITY_2)
			).rejects.toThrow();
		});

		test("throws when toIdentity is empty", async () => {
			const { connector } = createMockVaultConnector();
			await expect(
				AccountHelper.renameAccountKeys(undefined, connector, TEST_IDENTITY, "")
			).rejects.toThrow();
		});

		test("is a no-op when fromIdentity equals toIdentity", async () => {
			const { connector, secrets, keys } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const secretCountBefore = secrets.size;
			const keyCountBefore = keys.size;
			await AccountHelper.renameAccountKeys(undefined, connector, TEST_IDENTITY, TEST_IDENTITY);
			expect(secrets.size).toBe(secretCountBefore);
			expect(keys.size).toBe(keyCountBefore);
		});

		test("moves mnemonic and seed to the new identity", async () => {
			const { connector, secrets } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			await AccountHelper.renameAccountKeys(undefined, connector, TEST_IDENTITY, TEST_IDENTITY_2);
			expect(secrets.has(`${TEST_IDENTITY}/mnemonic`)).toBe(false);
			expect(secrets.has(`${TEST_IDENTITY}/seed`)).toBe(false);
			expect(secrets.get(`${TEST_IDENTITY_2}/mnemonic`)).toBe(TEST_MNEMONIC);
			expect(secrets.has(`${TEST_IDENTITY_2}/seed`)).toBe(true);
		});

		test("moves all address keys to the new identity", async () => {
			const { connector, keys } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			await AccountHelper.renameAccountKeys(undefined, connector, TEST_IDENTITY, TEST_IDENTITY_2);
			for (let i = 0; i < 25; i++) {
				expect(keys.has(`${TEST_IDENTITY}/account/0/0/${i}`)).toBe(false);
				expect(keys.has(`${TEST_IDENTITY_2}/account/0/0/${i}`)).toBe(true);
			}
		});

		test("handles missing seed gracefully", async () => {
			const { connector, secrets } = createMockVaultConnector();
			secrets.set(`${TEST_IDENTITY}/mnemonic`, TEST_MNEMONIC);
			await expect(
				AccountHelper.renameAccountKeys(undefined, connector, TEST_IDENTITY, TEST_IDENTITY_2)
			).resolves.not.toThrow();
			expect(secrets.get(`${TEST_IDENTITY_2}/mnemonic`)).toBe(TEST_MNEMONIC);
			expect(secrets.has(`${TEST_IDENTITY_2}/seed`)).toBe(false);
		});

		test("uses custom vault key names from config", async () => {
			const { connector, secrets } = createMockVaultConnector();
			const config: IAccountConfig = {
				vaultMnemonicId: "my-mnemonic",
				vaultSeedId: "my-seed"
			};
			await AccountHelper.createAccountKeys(config, connector, TEST_IDENTITY, TEST_MNEMONIC, 0);
			await AccountHelper.renameAccountKeys(config, connector, TEST_IDENTITY, TEST_IDENTITY_2);
			expect(secrets.has(`${TEST_IDENTITY}/my-mnemonic`)).toBe(false);
			expect(secrets.get(`${TEST_IDENTITY_2}/my-mnemonic`)).toBe(TEST_MNEMONIC);
		});
	});

	describe("removeAccountKeys", () => {
		test("throws when vault connector is undefined", async () => {
			await expect(
				AccountHelper.removeAccountKeys(
					undefined,
					undefined as unknown as IVaultConnector,
					TEST_IDENTITY
				)
			).rejects.toThrow();
		});

		test("throws when identity is empty", async () => {
			const { connector } = createMockVaultConnector();
			await expect(AccountHelper.removeAccountKeys(undefined, connector, "")).rejects.toThrow();
		});

		test("removes all keys and secrets for the identity", async () => {
			const { connector, secrets, keys } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			await AccountHelper.removeAccountKeys(undefined, connector, TEST_IDENTITY);
			expect(keys.size).toBe(0);
			expect(secrets.size).toBe(0);
		});

		test("does not affect keys for a different identity", async () => {
			const { connector, secrets, keys } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			await seedupAccount(connector, TEST_IDENTITY_2);
			await AccountHelper.removeAccountKeys(undefined, connector, TEST_IDENTITY);
			expect(secrets.has(`${TEST_IDENTITY_2}/mnemonic`)).toBe(true);
			expect(secrets.has(`${TEST_IDENTITY_2}/seed`)).toBe(true);
			for (let i = 0; i < 25; i++) {
				expect(keys.has(`${TEST_IDENTITY_2}/account/0/0/${i}`)).toBe(true);
			}
		});

		test("uses custom vault key names from config", async () => {
			const { connector, secrets } = createMockVaultConnector();
			const config: IAccountConfig = {
				vaultMnemonicId: "my-mnemonic",
				vaultSeedId: "my-seed"
			};
			await AccountHelper.createAccountKeys(config, connector, TEST_IDENTITY, TEST_MNEMONIC, 0);
			await AccountHelper.removeAccountKeys(config, connector, TEST_IDENTITY);
			expect(secrets.has(`${TEST_IDENTITY}/my-mnemonic`)).toBe(false);
			expect(secrets.has(`${TEST_IDENTITY}/my-seed`)).toBe(false);
		});
	});

	describe("getPublicKeys", () => {
		test("derives and stores 25 public keys when chunk is not cached", async () => {
			const { connector, keys } = createMockVaultConnector();
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			const publicKeys = await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				0,
				async () => seed
			);
			expect(publicKeys).toHaveLength(25);
			expect(keys.size).toBe(25);
		});

		test("returns base64-encoded public keys", async () => {
			const { connector } = createMockVaultConnector();
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			const publicKeys = await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				0,
				async () => seed
			);
			for (const key of publicKeys) {
				expect(key).toMatch(/^[A-Za-z0-9+/]+=*$/);
			}
		});

		test("reads from vault without calling seed provider when chunk is cached", async () => {
			const { connector } = createMockVaultConnector();
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			const first = await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				0,
				async () => seed
			);
			let seedProviderCalled = false;
			const second = await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				0,
				async () => {
					seedProviderCalled = true;
					return seed;
				}
			);
			expect(seedProviderCalled).toBe(false);
			expect(second).toEqual(first);
		});

		test("aligns address index to chunk boundary and caches indices 0-24", async () => {
			const { connector, keys } = createMockVaultConnector();
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				7,
				async () => seed
			);
			expect(keys.has(`${TEST_IDENTITY}/account/0/0/0`)).toBe(true);
			expect(keys.has(`${TEST_IDENTITY}/account/0/0/24`)).toBe(true);
			expect(keys.has(`${TEST_IDENTITY}/account/0/0/25`)).toBe(false);
		});

		test("caches the correct chunk when address index falls in the second chunk", async () => {
			const { connector, keys } = createMockVaultConnector();
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				25,
				async () => seed
			);
			expect(keys.has(`${TEST_IDENTITY}/account/0/0/0`)).toBe(false);
			expect(keys.has(`${TEST_IDENTITY}/account/0/0/25`)).toBe(true);
			expect(keys.has(`${TEST_IDENTITY}/account/0/0/49`)).toBe(true);
		});

		test("uses custom coin type when provided", async () => {
			const { connector } = createMockVaultConnector();
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			const withDefault = await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				0,
				async () => seed
			);
			const { connector: connector2 } = createMockVaultConnector();
			const withCustom = await AccountHelper.getPublicKeys(
				{ coinType: 60 },
				connector2,
				TEST_IDENTITY,
				0,
				false,
				0,
				async () => seed
			);
			expect(withDefault[0]).not.toBe(withCustom[0]);
		});

		test("stores keys with Ed25519 vault key type", async () => {
			const { connector, keys } = createMockVaultConnector();
			const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			await AccountHelper.getPublicKeys(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				false,
				0,
				async () => seed
			);
			const entry = keys.get(`${TEST_IDENTITY}/account/0/0/0`);
			expect(entry?.type).toBe(VaultKeyType.Ed25519);
		});
	});

	describe("getSeed", () => {
		test("returns seed from vault when present", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const seed = await AccountHelper.getSeed(undefined, connector, TEST_IDENTITY);
			expect(seed).toBeInstanceOf(Uint8Array);
			expect(seed.length).toBeGreaterThan(0);
		});

		test("derives and stores seed from mnemonic when seed is missing", async () => {
			const { connector, secrets } = createMockVaultConnector();
			secrets.set(`${TEST_IDENTITY}/mnemonic`, TEST_MNEMONIC);
			expect(secrets.has(`${TEST_IDENTITY}/seed`)).toBe(false);
			const seed = await AccountHelper.getSeed(undefined, connector, TEST_IDENTITY);
			expect(seed).toBeInstanceOf(Uint8Array);
			expect(secrets.has(`${TEST_IDENTITY}/seed`)).toBe(true);
		});

		test("derived seed matches expected value from mnemonic", async () => {
			const { connector, secrets } = createMockVaultConnector();
			secrets.set(`${TEST_IDENTITY}/mnemonic`, TEST_MNEMONIC);
			const seed = await AccountHelper.getSeed(undefined, connector, TEST_IDENTITY);
			const expected = Bip39.mnemonicToSeed(TEST_MNEMONIC);
			expect(seed).toEqual(expected);
		});

		test("uses custom vault key names from config", async () => {
			const { connector, secrets } = createMockVaultConnector();
			const config: IAccountConfig = { vaultSeedId: "my-seed", vaultMnemonicId: "my-mnemonic" };
			secrets.set(`${TEST_IDENTITY}/my-mnemonic`, TEST_MNEMONIC);
			const seed = await AccountHelper.getSeed(config, connector, TEST_IDENTITY);
			expect(seed).toBeInstanceOf(Uint8Array);
			expect(secrets.has(`${TEST_IDENTITY}/my-seed`)).toBe(true);
		});

		test("throws when neither seed nor mnemonic is present", async () => {
			const { connector } = createMockVaultConnector();
			await expect(AccountHelper.getSeed(undefined, connector, TEST_IDENTITY)).rejects.toThrow();
		});
	});

	describe("getAddresses", () => {
		test("throws when vault connector is undefined", async () => {
			await expect(
				AccountHelper.getAddresses(
					undefined,
					undefined as unknown as IVaultConnector,
					TEST_IDENTITY,
					0,
					0,
					1
				)
			).rejects.toThrow();
		});

		test("throws when identity is empty", async () => {
			const { connector } = createMockVaultConnector();
			await expect(AccountHelper.getAddresses(undefined, connector, "", 0, 0, 1)).rejects.toThrow();
		});

		test("throws when count is not an integer", async () => {
			const { connector } = createMockVaultConnector();
			await expect(
				AccountHelper.getAddresses(undefined, connector, TEST_IDENTITY, 0, 0, 1.5)
			).rejects.toThrow();
		});

		test("returns the requested number of addresses", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const addresses = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				3
			);
			expect(addresses).toHaveLength(3);
		});

		test("returns 0x-prefixed hex addresses", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const addresses = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				5
			);
			for (const address of addresses) {
				expect(address).toMatch(/^0x[0-9a-f]{64}$/);
			}
		});

		test("addresses are deterministic from the same mnemonic", async () => {
			const { connector: c1 } = createMockVaultConnector();
			const { connector: c2 } = createMockVaultConnector();
			await seedupAccount(c1, TEST_IDENTITY);
			await seedupAccount(c2, TEST_IDENTITY);
			const first = await AccountHelper.getAddresses(undefined, c1, TEST_IDENTITY, 0, 0, 5);
			const second = await AccountHelper.getAddresses(undefined, c2, TEST_IDENTITY, 0, 0, 5);
			expect(first).toEqual(second);
		});

		test("addresses at different start indices are distinct", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const first = await AccountHelper.getAddresses(undefined, connector, TEST_IDENTITY, 0, 0, 1);
			const second = await AccountHelper.getAddresses(undefined, connector, TEST_IDENTITY, 0, 1, 1);
			expect(first[0]).not.toBe(second[0]);
		});

		test("spans chunk boundary when count exceeds remaining chunk entries", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const addresses = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				23,
				5
			);
			expect(addresses).toHaveLength(5);
		});

		test("external and internal addresses are distinct", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const external = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				1,
				false
			);
			const internal = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				1,
				true
			);
			expect(external[0]).not.toBe(internal[0]);
		});

		test("uses custom coin type from config", async () => {
			const { connector: c1 } = createMockVaultConnector();
			const { connector: c2 } = createMockVaultConnector();
			await seedupAccount(c1, TEST_IDENTITY);
			await AccountHelper.createAccountKeys({ coinType: 60 }, c2, TEST_IDENTITY, TEST_MNEMONIC, 0);
			const defaultAddresses = await AccountHelper.getAddresses(
				undefined,
				c1,
				TEST_IDENTITY,
				0,
				0,
				1
			);
			const customAddresses = await AccountHelper.getAddresses(
				{ coinType: 60 },
				c2,
				TEST_IDENTITY,
				0,
				0,
				1
			);
			expect(defaultAddresses[0]).not.toBe(customAddresses[0]);
		});
	});

	describe("findAddressKey", () => {
		test("finds a key at index 0 and returns keyName and publicKey", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const addresses = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				1
			);
			const result = await AccountHelper.findAddressKey(
				undefined,
				connector,
				TEST_IDENTITY,
				addresses[0]
			);
			expect(result.keyName).toBe(`${TEST_IDENTITY}/account/0/0/0`);
			expect(result.publicKey).toBeInstanceOf(Uint8Array);
		});

		test("finds a key at a non-zero index", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const addresses = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				5
			);
			const result = await AccountHelper.findAddressKey(
				undefined,
				connector,
				TEST_IDENTITY,
				addresses[4]
			);
			expect(result.keyName).toBe(`${TEST_IDENTITY}/account/0/0/4`);
		});

		test("returned public key hashes to the searched address", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const addresses = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				3
			);
			const result = await AccountHelper.findAddressKey(
				undefined,
				connector,
				TEST_IDENTITY,
				addresses[2]
			);
			expect(AccountHelper.publicKeyToAddress(result.publicKey)).toBe(addresses[2]);
		});

		test("throws when the address is not found within scan range", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			await expect(
				AccountHelper.findAddressKey(undefined, connector, TEST_IDENTITY, "0xdeadbeef")
			).rejects.toThrow();
		});

		test("respects maxAddressScanRange from config", async () => {
			const { connector } = createMockVaultConnector();
			await seedupAccount(connector, TEST_IDENTITY);
			const addresses = await AccountHelper.getAddresses(
				undefined,
				connector,
				TEST_IDENTITY,
				0,
				0,
				1
			);
			await expect(
				AccountHelper.findAddressKey(
					{ maxAddressScanRange: 0 },
					connector,
					TEST_IDENTITY,
					addresses[0]
				)
			).rejects.toThrow();
		});
	});
});
