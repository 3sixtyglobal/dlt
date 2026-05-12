// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClientOptions } from "@iota/iota-sdk/client";
import { Converter } from "@twin.org/core";
import { Bip39, Bip44, KeyType } from "@twin.org/crypto";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVaultConnector,
	initSchema,
	type VaultKey,
	type VaultSecret
} from "@twin.org/vault-connector-entity-storage";
import type { IVaultConnector } from "@twin.org/vault-models";
import { TEST_CLIENT_OPTIONS, TEST_MNEMONIC, TEST_NETWORK } from "./setupTestEnv.js";
import { Iota } from "../src/iota.js";
import type { IIotaConfig } from "../src/models/IIotaConfig.js";

// Pre-compute deterministic values from the fixed test mnemonic so getStore()
// assertions can match exact content rather than just structural shape.
const ADDRESS_CHUNK_SIZE = 25;
const TEST_SEED = Bip39.mnemonicToSeed(TEST_MNEMONIC);
const TEST_SEED_BASE64 = Converter.bytesToBase64(TEST_SEED);

const TEST_CHUNK_KEYPAIRS: { privateKey: string; publicKey: string }[] = [];

for (let i = 0; i < ADDRESS_CHUNK_SIZE; i++) {
	const kp = Bip44.keyPair(TEST_SEED, KeyType.Ed25519, Iota.DEFAULT_COIN_TYPE, 0, false, i);
	TEST_CHUNK_KEYPAIRS.push({
		privateKey: Converter.bytesToBase64(kp.privateKey),
		publicKey: Converter.bytesToBase64(kp.publicKey)
	});
}

let keyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
let secretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

describe("Iota", () => {
	const TEST_IDENTITY = "test-identity";

	const TEST_CONFIG: IIotaConfig = {
		clientOptions: TEST_CLIENT_OPTIONS,
		network: TEST_NETWORK
	};

	beforeAll(() => {
		initSchema();
	});

	beforeEach(() => {
		keyEntityStorage = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>()
		});
		secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>()
		});

		EntityStorageConnectorFactory.register("vault-key", () => keyEntityStorage);
		EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);
	});

	afterEach(() => {
		EntityStorageConnectorFactory.unregister("vault-key");
		EntityStorageConnectorFactory.unregister("vault-secret");
	});

	/**
	 * Creates a fresh vault connector backed by in-memory entity storage.
	 * @returns A new EntityStorageVaultConnector instance.
	 */
	function createVault(): EntityStorageVaultConnector {
		return new EntityStorageVaultConnector();
	}

	/**
	 * Creates a vault pre-populated with the test mnemonic secret.
	 * @returns A vault connector ready for use with Iota methods.
	 */
	async function vaultWithMnemonic(): Promise<IVaultConnector> {
		const vault = createVault();
		await vault.setSecret(`${TEST_IDENTITY}/mnemonic`, TEST_MNEMONIC);
		return vault;
	}

	describe("createClient / populateConfig", () => {
		test("can create a client", () => {
			const config: IIotaConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK
			};

			const client = Iota.createClient(config);
			expect(client).toBeDefined();
		});

		test("can fail to create a client with no url", () => {
			const config: IIotaConfig = {
				clientOptions: {
					url: undefined
				} as unknown as IotaClientOptions,
				network: TEST_NETWORK
			};

			expect(() => Iota.createClient(config)).toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.string",
					properties: {
						property: "config.clientOptions.url",
						value: "undefined"
					}
				})
			);
		});

		test("can populate config defaults", () => {
			const config: IIotaConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK
			};

			Iota.populateConfig(config);

			expect(config.vaultMnemonicId).toBe("mnemonic");
			expect(config.coinType).toBe(4218);
		});
	});

	describe("storeMnemonic", () => {
		test("stores the mnemonic in the secret store", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const secrets = secretEntityStorage.getStore();
			const mnemonicEntry = secrets.find(s => s.id === `${TEST_IDENTITY}/mnemonic`);
			expect(mnemonicEntry).toBeDefined();
			expect(mnemonicEntry?.data).toBe(TEST_MNEMONIC);
		});

		test("stores the derived seed in the secret store", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const secrets = secretEntityStorage.getStore();
			const seedEntry = secrets.find(s => s.id === `${TEST_IDENTITY}/seed`);
			expect(seedEntry).toBeDefined();
			expect(seedEntry?.data).toBe(TEST_SEED_BASE64);
		});

		test("pre-caches the first keypair chunk in the secret store", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const secrets = secretEntityStorage.getStore();
			const keypairChunk = secrets.find(s => s.id === `${TEST_IDENTITY}/account/0/0/0`);
			expect(keypairChunk).toBeDefined();
			expect(keypairChunk?.data).toEqual(TEST_CHUNK_KEYPAIRS);
		});

		test("enables getAddresses to work after storage", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const addresses = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1);
			expect(addresses).toHaveLength(1);
			expect(addresses[0]).toBeDefined();
		});

		test("enables getKeyPair to work after storage", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const keyPair = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
		});

		test("produces the same addresses as a pre-populated vault", async () => {
			const storedVault = createVault();
			await Iota.storeMnemonic(storedVault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);
			const addresses1 = await Iota.getAddresses(storedVault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 5);

			const prePopulatedVault = await vaultWithMnemonic();
			const addresses2 = await Iota.getAddresses(
				prePopulatedVault,
				TEST_CONFIG,
				TEST_IDENTITY,
				0,
				0,
				5
			);
			expect(addresses1).toEqual(addresses2);
		});

		test("produces the same keypairs as a pre-populated vault", async () => {
			const storedVault = createVault();
			await Iota.storeMnemonic(storedVault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);
			const keyPair1 = await Iota.getKeyPair(storedVault, TEST_CONFIG, TEST_IDENTITY, 0, 0);

			const prePopulatedVault = await vaultWithMnemonic();
			const keyPair2 = await Iota.getKeyPair(prePopulatedVault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(keyPair1).toEqual(keyPair2);
		});

		test("returns the mnemonic that was stored", async () => {
			const vault = createVault();
			const returned = await Iota.storeMnemonic(
				vault,
				TEST_CONFIG,
				TEST_IDENTITY,
				TEST_MNEMONIC,
				0
			);
			expect(returned).toBe(TEST_MNEMONIC);
		});

		test("generates a new mnemonic when undefined is passed", async () => {
			const vault = createVault();
			const generated = await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, undefined, 0);
			expect(typeof generated).toBe("string");
			expect(generated.split(" ").length).toBeGreaterThanOrEqual(12);

			const secrets = secretEntityStorage.getStore();
			const mnemonicEntry = secrets.find(s => s.id === `${TEST_IDENTITY}/mnemonic`);
			expect(mnemonicEntry?.data).toBe(generated);
		});

		test("throws for null vaultConnector", async () => {
			await expect(
				Iota.storeMnemonic(
					null as unknown as IVaultConnector,
					TEST_CONFIG,
					TEST_IDENTITY,
					TEST_MNEMONIC,
					0
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.object",
					source: "Iota",
					properties: { property: "vaultConnector", value: null }
				})
			);
		});

		test("throws for invalid accountIndex", async () => {
			const vault = createVault();
			await expect(
				Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, Number.NaN)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "Iota",
					properties: { property: "accountIndex", value: Number.NaN, options: undefined }
				})
			);
		});
	});

	describe("getAddresses", () => {
		test("can get addresses", async () => {
			const vault = await vaultWithMnemonic();

			const addresses = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1, false);
			expect(addresses).toHaveLength(1);
			expect(addresses[0]).toBeDefined();
		});

		test("generates multiple addresses with count parameter", async () => {
			const vault = await vaultWithMnemonic();

			const count = 3;
			const addresses = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, count);
			expect(addresses).toHaveLength(count);
			expect(new Set(addresses).size).toBe(count);
		});

		test("generates different addresses for different account indices", async () => {
			const vault = await vaultWithMnemonic();

			const address1 = (await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1))[0];
			const address2 = (await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 1, 0, 1))[0];
			expect(address1).not.toBe(address2);
		});

		test("generates different addresses for different address indices", async () => {
			const vault = await vaultWithMnemonic();

			const address1 = (await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1))[0];
			const address2 = (await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 1, 1))[0];
			expect(address1).not.toBe(address2);
		});

		test("generates different addresses for internal vs external", async () => {
			const vault = await vaultWithMnemonic();

			const external = (
				await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1, false)
			)[0];
			const internal = (
				await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1, true)
			)[0];
			expect(external).not.toBe(internal);
		});

		test("generates consistent addresses for same parameters", async () => {
			const vault = await vaultWithMnemonic();

			const addresses1 = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 2);
			const addresses2 = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 2);
			expect(addresses1).toEqual(addresses2);
		});

		test("caches keypairs in the secret store", async () => {
			const vault = await vaultWithMnemonic();
			await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1);

			const secrets = secretEntityStorage.getStore();
			const keypairChunk = secrets.find(s => s.id === `${TEST_IDENTITY}/account/0/0/0`);
			expect(keypairChunk?.data).toEqual(TEST_CHUNK_KEYPAIRS);
		});

		test("throws for null vaultConnector", async () => {
			await expect(
				Iota.getAddresses(null as unknown as IVaultConnector, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.object",
					source: "Iota",
					properties: { property: "vaultConnector", value: null }
				})
			);
		});

		test("throws for invalid startAddressIndex", async () => {
			const vault = await vaultWithMnemonic();
			await expect(
				Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, Number.NaN, 1)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "Iota",
					properties: { property: "startAddressIndex", value: Number.NaN, options: undefined }
				})
			);
		});

		test("throws for invalid count", async () => {
			const vault = await vaultWithMnemonic();
			await expect(
				Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, Number.NaN)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "Iota",
					properties: { property: "count", value: Number.NaN, options: undefined }
				})
			);
		});
	});

	describe("getKeyPair", () => {
		test("can generate a key pair for specified index", async () => {
			const vault = await vaultWithMnemonic();

			const keyPair = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.privateKey.length).toBeGreaterThan(0);
			expect(keyPair.publicKey.length).toBeGreaterThan(0);
		});

		test("public key produces the matching address", async () => {
			const vault = await vaultWithMnemonic();

			const addresses = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 5, 1);
			const keyPair = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 5);

			const derivedAddress = Iota.publicKeyToAddress(keyPair.publicKey);
			expect(derivedAddress).toBe(addresses[0]);
		});

		test("generates different key pairs for different account indices", async () => {
			const vault = await vaultWithMnemonic();

			const keyPair1 = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const keyPair2 = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 1, 0);
			expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
			expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
		});

		test("generates different key pairs for different address indices", async () => {
			const vault = await vaultWithMnemonic();

			const keyPair1 = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const keyPair2 = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 1);
			expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
			expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
		});

		test("generates different key pairs for internal vs external", async () => {
			const vault = await vaultWithMnemonic();

			const external = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, false);
			const internal = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, true);
			expect(external.privateKey).not.toEqual(internal.privateKey);
		});

		test("generates consistent key pairs for same parameters", async () => {
			const vault = await vaultWithMnemonic();

			const keyPair1 = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const keyPair2 = await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(keyPair1).toEqual(keyPair2);
		});

		test("caches results in the secret store", async () => {
			const vault = await vaultWithMnemonic();
			await Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);

			const secrets = secretEntityStorage.getStore();
			const keypairChunk = secrets.find(s => s.id === `${TEST_IDENTITY}/account/0/0/0`);
			expect(keypairChunk?.data).toEqual(TEST_CHUNK_KEYPAIRS);
		});

		test("throws for null vaultConnector", async () => {
			await expect(
				Iota.getKeyPair(null as unknown as IVaultConnector, TEST_CONFIG, TEST_IDENTITY, 0, 0)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.object",
					source: "Iota",
					properties: { property: "vaultConnector", value: null }
				})
			);
		});

		test("throws for invalid account index", async () => {
			const vault = await vaultWithMnemonic();

			await expect(
				Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, Number.NaN, 0)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "Iota",
					properties: { property: "accountIndex", value: Number.NaN, options: undefined }
				})
			);
		});

		test("throws for invalid address index", async () => {
			const vault = await vaultWithMnemonic();

			await expect(
				Iota.getKeyPair(vault, TEST_CONFIG, TEST_IDENTITY, 0, Number.NaN)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "Iota",
					properties: { property: "addressIndex", value: Number.NaN, options: undefined }
				})
			);
		});
	});

	describe("findAddress", () => {
		test("can find an address at index 0", async () => {
			const vault = await vaultWithMnemonic();

			const [address] = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1, false);
			const found = await Iota.findAddress(vault, TEST_CONFIG, TEST_IDENTITY, address, 0);
			expect(found.address).toBe(address);
		});

		test("returns valid privateKey and publicKey", async () => {
			const vault = await vaultWithMnemonic();

			const [address] = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1, false);
			const found = await Iota.findAddress(vault, TEST_CONFIG, TEST_IDENTITY, address, 0);
			expect(found.privateKey).toBeInstanceOf(Uint8Array);
			expect(found.publicKey).toBeInstanceOf(Uint8Array);
			expect(found.privateKey.length).toBeGreaterThan(0);
			expect(found.publicKey.length).toBeGreaterThan(0);
		});

		test("returned keypair matches the address", async () => {
			const vault = await vaultWithMnemonic();

			const [address] = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 3, 1, false);
			const found = await Iota.findAddress(vault, TEST_CONFIG, TEST_IDENTITY, address, 0);

			const derivedAddress = Iota.publicKeyToAddress(found.publicKey);
			expect(derivedAddress).toBe(address);
		});

		test("can find an address at a non-zero start index", async () => {
			const vault = await vaultWithMnemonic();

			const [address] = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 10, 1, false);
			const found = await Iota.findAddress(
				vault,
				TEST_CONFIG,
				TEST_IDENTITY,
				address,
				0,
				false,
				10
			);
			expect(found.address).toBe(address);
		});

		test("searches the correct account index", async () => {
			const vault = await vaultWithMnemonic();

			const [addressAccount1] = await Iota.getAddresses(
				vault,
				TEST_CONFIG,
				TEST_IDENTITY,
				1,
				0,
				1,
				false
			);
			const found = await Iota.findAddress(vault, TEST_CONFIG, TEST_IDENTITY, addressAccount1, 1);
			expect(found.address).toBe(addressAccount1);
		});

		test("finds internal addresses", async () => {
			const vault = await vaultWithMnemonic();

			const [internalAddress] = await Iota.getAddresses(
				vault,
				TEST_CONFIG,
				TEST_IDENTITY,
				0,
				0,
				1,
				true
			);
			const found = await Iota.findAddress(
				vault,
				TEST_CONFIG,
				TEST_IDENTITY,
				internalAddress,
				0,
				true
			);
			expect(found.address).toBe(internalAddress);
		});

		test("throws when address not found within maxScanRange", async () => {
			const vault = await vaultWithMnemonic();

			await expect(
				Iota.findAddress(
					vault,
					TEST_CONFIG,
					TEST_IDENTITY,
					"0x000000000000000000000000000000000000000000000000000000000000dead",
					0,
					false,
					0,
					25
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					message: "iota.addressNotFound"
				})
			);
		});
	});

	describe("isAbortError", () => {
		test("does not detect MoveAbort error with code 401", () => {
			const error = {
				properties: {
					error: "MoveAbort: 401"
				}
			};

			expect(Iota.isAbortError(error, 401)).toBe(false);
		});

		test("detects abort code 401 in command failure message", () => {
			const error = {
				properties: {
					error:
						"Error in 1st command, from '0x9932d9548ee68486d60d8743e446e9df9e7a20b1d39f3df7bbcf84851bc48945::verifiable_storage::update_data' (instruction 15), abort code: 401"
				}
			};

			expect(Iota.isAbortError(error, 401)).toBe(true);
		});

		test("detects abort code 401 in Move Runtime Abort message", () => {
			const error = {
				properties: {
					error:
						"Move Runtime Abort. Location: 75ee00505d2b4d731d10216d69cff74cbc4d91f1bc72b0f6888ac311d632bc19::verifiable_storage::update_data (function index 4) at offset 15, Abort Code: 401 in command 0"
				}
			};

			expect(Iota.isAbortError(error, 401)).toBe(true);
		});

		test("does not match abort error when code differs", () => {
			const error = {
				properties: {
					error:
						"Error in 1st command, from '0x9932d9548ee68486d60d8743e446e9df9e7a20b1d39f3df7bbcf84851bc48945::verifiable_storage::update_data' (instruction 15), abort code: 401"
				}
			};

			expect(Iota.isAbortError(error, 402)).toBe(false);
		});
	});
});
