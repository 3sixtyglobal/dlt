// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClientOptions } from "@iota/iota-sdk/client";
import { Converter } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
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

const ADDRESS_CHUNK_SIZE = 25;
const TEST_SEED = Bip39.mnemonicToSeed(TEST_MNEMONIC);
const TEST_SEED_BASE64 = Converter.bytesToBase64(TEST_SEED);

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
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-key" }
		});
		secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secret" }
		});

		EntityStorageConnectorFactory.register("vault-key", () => keyEntityStorage);
		EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);
	});

	afterEach(async () => {
		await keyEntityStorage.teardown();
		await secretEntityStorage.teardown();
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

			const secrets = await secretEntityStorage.getStore();
			const mnemonicEntry = secrets.find(s => s.id === `${TEST_IDENTITY}/mnemonic`);
			expect(mnemonicEntry).toBeDefined();
			expect(mnemonicEntry?.data).toBe(TEST_MNEMONIC);
		});

		test("stores the derived seed in the secret store", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const secrets = await secretEntityStorage.getStore();
			const seedEntry = secrets.find(s => s.id === `${TEST_IDENTITY}/seed`);
			expect(seedEntry).toBeDefined();
			expect(seedEntry?.data).toBe(TEST_SEED_BASE64);
		});

		test("pre-caches the first keypair range as individual vault keys", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const keys = await keyEntityStorage.getStore();
			for (let i = 0; i < ADDRESS_CHUNK_SIZE; i++) {
				const key = keys.find(k => k.id === `${TEST_IDENTITY}/account/0/0/${i}`);
				expect(key).toBeDefined();
			}
		});

		test("enables getAddresses to work after storage", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);

			const addresses = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1);
			expect(addresses).toHaveLength(1);
			expect(addresses[0]).toBeDefined();
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

			const secrets = await secretEntityStorage.getStore();
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

		test("caches keypairs as individual vault keys", async () => {
			const vault = await vaultWithMnemonic();
			await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1);

			const keys = await keyEntityStorage.getStore();
			for (let i = 0; i < ADDRESS_CHUNK_SIZE; i++) {
				const key = keys.find(k => k.id === `${TEST_IDENTITY}/account/0/0/${i}`);
				expect(key).toBeDefined();
			}
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

	describe("getTransactionSigner", () => {
		test("returns an object with the expected interface", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(signer).toBeDefined();
			expect(typeof signer.sign).toBe("function");
			expect(typeof signer.publicKey).toBe("function");
			expect(typeof signer.iotaPublicKeyBytes).toBe("function");
			expect(typeof signer.keyId).toBe("function");
		});

		test("keyId returns the correct vault key name for index 0", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(signer.keyId()).toBe(`${TEST_IDENTITY}/account/0/0/0`);
		});

		test("keyId reflects account and address indices", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 1, 3);
			expect(signer.keyId()).toBe(`${TEST_IDENTITY}/account/1/0/3`);
		});

		test("publicKey returns a 32-byte Ed25519 raw key", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const pk = await signer.publicKey();
			expect(pk.toRawBytes()).toHaveLength(32);
		});

		test("iotaPublicKeyBytes returns 33 bytes with Ed25519 flag prefix", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const bytes = await signer.iotaPublicKeyBytes();
			expect(bytes).toHaveLength(33); // 1 scheme-flag byte + 32 key bytes
			expect(bytes[0]).toBe(0); // Ed25519 flag
		});

		test("address derived from signer public key matches getAddresses output", async () => {
			const vault = await vaultWithMnemonic();
			const [expectedAddress] = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1);
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const pk = await signer.publicKey();
			expect(Iota.publicKeyToAddress(pk.toRawBytes())).toBe(expectedAddress);
		});

		test("different address indices produce different public keys", async () => {
			const vault = await vaultWithMnemonic();
			const signer0 = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const signer1 = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 1);
			const pk0 = await signer0.publicKey();
			const pk1 = await signer1.publicKey();
			expect(pk0.toRawBytes()).not.toEqual(pk1.toRawBytes());
		});

		test("sign returns a base64 string of 97 serialized bytes (flag + sig + pubkey)", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const txBytes = new Uint8Array(64).fill(1);
			const signature = await signer.sign(txBytes);
			expect(typeof signature).toBe("string");
			const decoded = Buffer.from(signature, "base64");
			expect(decoded.length).toBe(97); // 1 flag + 64 sig + 32 pubkey
			expect(decoded[0]).toBe(0); // Ed25519 scheme flag
		});

		test("signing the same bytes twice returns the same signature", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const txBytes = new Uint8Array(64).fill(1);
			expect(await signer.sign(txBytes)).toBe(await signer.sign(txBytes));
		});

		test("throws for null vaultConnector", async () => {
			await expect(
				Iota.getTransactionSigner(
					null as unknown as IVaultConnector,
					TEST_CONFIG,
					TEST_IDENTITY,
					0,
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

		test("throws for empty identity", async () => {
			const vault = await vaultWithMnemonic();
			await expect(Iota.getTransactionSigner(vault, TEST_CONFIG, "", 0, 0)).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.stringEmpty",
					source: "Iota",
					properties: { property: "identity", value: "" }
				})
			);
		});

		test("throws for non-integer accountIndex", async () => {
			const vault = await vaultWithMnemonic();
			await expect(
				Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, Number.NaN, 0)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "Iota",
					properties: { property: "accountIndex", value: Number.NaN, options: undefined }
				})
			);
		});

		test("throws for non-integer addressIndex", async () => {
			const vault = await vaultWithMnemonic();
			await expect(
				Iota.getTransactionSigner(vault, TEST_CONFIG, TEST_IDENTITY, 0, Number.NaN)
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
