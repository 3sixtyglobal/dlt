// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClientOptions } from "@iota/iota-sdk/client";
import { Transaction } from "@iota/iota-sdk/transactions";
import { BaseError, Converter, GeneralError } from "@twin.org/core";
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
import { FetchHelper } from "@twin.org/web";
import {
	TEST_CLIENT_OPTIONS,
	TEST_EXPLORER_URL,
	TEST_FAUCET_ENDPOINT,
	TEST_MNEMONIC,
	TEST_NETWORK,
	setupTestEnv
} from "./setupTestEnv.js";
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

	beforeAll(async () => {
		await setupTestEnv();
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

	describe("object reservation conflicts", () => {
		// Verbatim node message reproduced by the IOTA source test
		// crates/iota-json-rpc/src/error.rs::test_objects_double_used.
		const RESERVED_MESSAGE =
			"Failed to sign transaction by a quorum of validators because one or more of its objects is reserved for another transaction. Other transactions locking these objects:\n" +
			"- 4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi (stake 80.0)\n" +
			"- 8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR (stake 5.0)";
		// The non-retryable variant of the same node error.
		const EQUIVOCATED_MESSAGE =
			"Failed to sign transaction by a quorum of validators because one or more of its objects is equivocated until the next epoch. Other transactions locking these objects:\n" +
			"- 4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi (stake 80.0)";
		// Verbatim node error when a concurrent transaction already consumed the referenced object
		// version (crates/iota-types/src/error.rs ObjectVersionUnavailableForConsumption wrapped by
		// quorum_driver_types.rs NonRecoverableTransactionError).
		const STALE_VERSION_MESSAGE =
			"Transaction execution failed due to issues with transaction inputs, please review the errors and try again:\n" +
			"- Object ID 0x00bf8123e61f47bbaf976a1723955571cb4808321b60efbabf79366d656f4165 Version 958986780 Digest 2jX46bsvCW5dpdZbaMvZRSGmk6UHcsybACxTV4E3uciL is not available for consumption, current version: 958986781";

		const RETRY_CONFIG: IIotaConfig = {
			...TEST_CONFIG,
			objectLockRetries: 2,
			objectLockRetryDelayMs: 1
		};

		test("isReservedObjectError detects the raw reserved-object node error", () => {
			expect(Iota.isReservedObjectError(new Error(RESERVED_MESSAGE))).toBe(true);
		});

		test("isReservedObjectError detects a reserved-object error nested in a wrapped cause", () => {
			const wrapped = new GeneralError("Test", "wrapped", undefined, new Error(RESERVED_MESSAGE));
			expect(Iota.isReservedObjectError(wrapped)).toBe(true);
		});

		test("isReservedObjectError does not treat an equivocated conflict as retryable", () => {
			expect(Iota.isReservedObjectError(new Error(EQUIVOCATED_MESSAGE))).toBe(false);
		});

		test("isReservedObjectError does not match an unrelated error", () => {
			expect(Iota.isReservedObjectError(new Error("Some other failure"))).toBe(false);
		});

		test("isReservedObjectError does not match a stale-version conflict", () => {
			expect(Iota.isReservedObjectError(new Error(STALE_VERSION_MESSAGE))).toBe(false);
		});

		test("isRetryableObjectConflictError detects the reserved-object node error", () => {
			expect(Iota.isRetryableObjectConflictError(new Error(RESERVED_MESSAGE))).toBe(true);
		});

		test("isRetryableObjectConflictError detects the stale-version node error", () => {
			expect(Iota.isRetryableObjectConflictError(new Error(STALE_VERSION_MESSAGE))).toBe(true);
		});

		test("isRetryableObjectConflictError detects a stale-version error in the escaped gas-station shape", () => {
			const wrapped = new GeneralError(
				"Iota",
				"gasStationTransactionFailed",
				undefined,
				new Error(
					`ErrorObject { code: ServerError(-32002), message: "${STALE_VERSION_MESSAGE.replace(/\n/g, "\\n")}", data: None }`
				)
			);
			expect(Iota.isRetryableObjectConflictError(wrapped)).toBe(true);
		});

		test("isRetryableObjectConflictError does not treat an equivocated conflict as retryable", () => {
			expect(Iota.isRetryableObjectConflictError(new Error(EQUIVOCATED_MESSAGE))).toBe(false);
		});

		test("isRetryableObjectConflictError does not match an unrelated error", () => {
			expect(Iota.isRetryableObjectConflictError(new Error("Some other failure"))).toBe(false);
		});

		// Through the gas station the node error surfaces as an HTTP failure whose body the fetch
		// layer nests as the message of a cause error, wrapped in a Debug-formatted
		// "ErrorObject { ... }" envelope in which the node message's newlines are escaped to the
		// literal two-character sequence "\n" (this is the real wire shape, not real newlines).
		const gasStationError = (): GeneralError =>
			new GeneralError(
				"Iota",
				"gasStationTransactionFailed",
				undefined,
				new Error(
					`ErrorObject { code: ServerError(-32002), message: "${RESERVED_MESSAGE.replace(/\n/g, "\\n")}", data: None }`
				)
			);

		test("isReservedObjectError detects a reserved-object error from the gas-station failure", () => {
			expect(Iota.isReservedObjectError(gasStationError())).toBe(true);
		});

		test("extractReservationConflictDigests parses digests from the gas-station failure", () => {
			expect(Iota.extractReservationConflictDigests(gasStationError())).toEqual([
				"4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi",
				"8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR"
			]);
		});

		test("extractReservationConflictDigests parses the conflicting transaction digests", () => {
			expect(Iota.extractReservationConflictDigests(new Error(RESERVED_MESSAGE))).toEqual([
				"4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi",
				"8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR"
			]);
		});

		test("extractReservationConflictDigests returns an empty array for an unrelated error", () => {
			expect(Iota.extractReservationConflictDigests(new Error("nope"))).toEqual([]);
		});

		test("extractReservationConflictDigests returns an empty array for a stale-version conflict", () => {
			expect(Iota.extractReservationConflictDigests(new Error(STALE_VERSION_MESSAGE))).toEqual([]);
		});

		test("executeWithReservationRetry retries a reserved-object conflict then succeeds", async () => {
			let calls = 0;
			const result = await Iota.executeWithReservationRetry(RETRY_CONFIG, async () => {
				calls++;
				if (calls < 2) {
					throw new Error(RESERVED_MESSAGE);
				}
				return "ok";
			});

			expect(result).toEqual("ok");
			expect(calls).toEqual(2);
		});

		test("executeWithReservationRetry throws objectReservationConflict after exhausting retries", async () => {
			let calls = 0;
			await expect(
				Iota.executeWithReservationRetry(RETRY_CONFIG, async () => {
					calls++;
					throw new Error(RESERVED_MESSAGE);
				})
			).rejects.toThrow(/objectReservationConflict/);

			// 1 initial attempt + objectLockRetries (2)
			expect(calls).toEqual(3);
		});

		test("executeWithReservationRetry does not retry a non-reservation error", async () => {
			let calls = 0;
			await expect(
				Iota.executeWithReservationRetry(RETRY_CONFIG, async () => {
					calls++;
					throw new Error("A different failure");
				})
			).rejects.toThrow(/A different failure/);

			expect(calls).toEqual(1);
		});

		test("executeWithReservationRetry retries a stale-version conflict then succeeds", async () => {
			let calls = 0;
			const result = await Iota.executeWithReservationRetry(RETRY_CONFIG, async () => {
				calls++;
				if (calls < 2) {
					throw new Error(STALE_VERSION_MESSAGE);
				}
				return "ok";
			});

			expect(result).toEqual("ok");
			expect(calls).toEqual(2);
		});

		test("executeWithReservationRetry clamps negative retries and still runs the operation once", async () => {
			let calls = 0;
			const result = await Iota.executeWithReservationRetry(
				{ ...TEST_CONFIG, objectLockRetries: -5, objectLockRetryDelayMs: 1 },
				async () => {
					calls++;
					return "ok";
				}
			);

			expect(result).toEqual("ok");
			expect(calls).toEqual(1);
		});

		test("executeWithReservationRetry throws for a non-integer retry configuration", async () => {
			await expect(
				Iota.executeWithReservationRetry(
					{ ...TEST_CONFIG, objectLockRetries: 1.5 },
					async () => "ok"
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					properties: { property: "config.objectLockRetries", value: 1.5 }
				})
			);
		});
	});

	describe("transaction template rebuild", () => {
		const ADDRESS = `0x${"1".repeat(64)}`;
		const gasPayment = (tx: Transaction): unknown =>
			(tx.getData().gasData as { payment?: unknown }).payment ?? null;

		// The retry recovery relies on cloning an unresolved transaction per attempt so gas and
		// object versions re-resolve on each build. This guards that Transaction.from round-trips
		// an unresolved transaction faithfully and without mutating the source.
		test("cloning an unresolved transaction round-trips it without mutating the source", () => {
			const txb = new Transaction();
			txb.setSender(ADDRESS);
			const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(1000)]);
			txb.transferObjects([coin], txb.pure.address(ADDRESS));

			const template = Transaction.from(txb);
			const templateData = template.getData();

			const clone = Transaction.from(template);
			const cloneData = clone.getData();

			// The clone faithfully reproduces the template's commands and inputs.
			expect(cloneData.commands).toEqual(templateData.commands);
			expect(cloneData.inputs).toEqual(templateData.inputs);
			expect(cloneData.sender).toEqual(templateData.sender);
			// Gas payment is still unresolved (null) on both, so each build re-selects gas coins.
			expect(gasPayment(clone)).toBeNull();
			expect(gasPayment(template)).toBeNull();
			// Cloning does not mutate the template, so it can be reused on every retry.
			expect(template.getData().commands).toEqual(templateData.commands);
		});
	});

	describe("ensureBalance", () => {
		const TEST_ADDRESS = `0x${"a".repeat(64)}`;

		afterEach(() => {
			vi.restoreAllMocks();
			vi.useRealTimers();
		});

		test("throws for null config", async () => {
			await expect(
				Iota.ensureBalance(
					null as unknown as IIotaConfig,
					undefined,
					TEST_IDENTITY,
					TEST_ADDRESS,
					100n
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.object",
					source: "Iota",
					properties: { property: "config", value: null }
				})
			);
		});

		test("throws for empty identity", async () => {
			await expect(
				Iota.ensureBalance(TEST_CONFIG, undefined, "", TEST_ADDRESS, 100n)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.stringEmpty",
					source: "Iota",
					properties: { property: "identity", value: "" }
				})
			);
		});

		test("throws for empty address", async () => {
			await expect(
				Iota.ensureBalance(TEST_CONFIG, undefined, TEST_IDENTITY, "", 100n)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.stringEmpty",
					source: "Iota",
					properties: { property: "address", value: "" }
				})
			);
		});

		test("throws for non-bigint ensureBalance", async () => {
			await expect(
				Iota.ensureBalance(
					TEST_CONFIG,
					undefined,
					TEST_IDENTITY,
					TEST_ADDRESS,
					100 as unknown as bigint
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.bigint",
					source: "Iota",
					properties: { property: "ensureBalance", value: 100 }
				})
			);
		});

		test("returns true when balance already meets target without faucetUrl", async () => {
			vi.spyOn(Iota, "getBalance").mockResolvedValue(100n);

			const result = await Iota.ensureBalance(
				TEST_CONFIG,
				undefined,
				TEST_IDENTITY,
				TEST_ADDRESS,
				100n
			);

			expect(result).toBe(true);
		});

		test("returns false when balance is below target without faucetUrl", async () => {
			vi.spyOn(Iota, "getBalance").mockResolvedValue(50n);

			const result = await Iota.ensureBalance(
				TEST_CONFIG,
				undefined,
				TEST_IDENTITY,
				TEST_ADDRESS,
				100n
			);

			expect(result).toBe(false);
		});

		test("returns true immediately when balance already meets target with faucetUrl", async () => {
			vi.spyOn(Iota, "getBalance").mockResolvedValue(100n);
			const fundSpy = vi.spyOn(Iota, "fundAddress");

			const result = await Iota.ensureBalance(
				TEST_CONFIG,
				TEST_FAUCET_ENDPOINT,
				TEST_IDENTITY,
				TEST_ADDRESS,
				100n
			);

			expect(result).toBe(true);
			expect(fundSpy).not.toHaveBeenCalled();
		});

		test("returns true when a single fundAddress call brings balance to target", async () => {
			vi.spyOn(Iota, "getBalance").mockResolvedValue(0n);
			vi.spyOn(Iota, "fundAddress").mockResolvedValue(100n);

			const result = await Iota.ensureBalance(
				TEST_CONFIG,
				TEST_FAUCET_ENDPOINT,
				TEST_IDENTITY,
				TEST_ADDRESS,
				100n
			);

			expect(result).toBe(true);
		});

		test("returns false immediately when fundAddress returns 0n", async () => {
			vi.spyOn(Iota, "getBalance").mockResolvedValue(0n);
			vi.spyOn(Iota, "fundAddress").mockResolvedValue(0n);

			const result = await Iota.ensureBalance(
				TEST_CONFIG,
				TEST_FAUCET_ENDPOINT,
				TEST_IDENTITY,
				TEST_ADDRESS,
				100n
			);

			expect(result).toBe(false);
		});

		test("retries when each top-up is insufficient, returns true once target is met", async () => {
			vi.useFakeTimers();
			vi.spyOn(Iota, "getBalance").mockResolvedValue(0n);
			vi.spyOn(Iota, "fundAddress").mockResolvedValue(50n);

			const promise = Iota.ensureBalance(
				TEST_CONFIG,
				TEST_FAUCET_ENDPOINT,
				TEST_IDENTITY,
				TEST_ADDRESS,
				100n
			);
			await vi.runAllTimersAsync();

			expect(await promise).toBe(true);
			expect(Iota.fundAddress).toHaveBeenCalledTimes(2);
		});

		test("returns false when retryCount is exhausted with balance still below target", async () => {
			vi.useFakeTimers();
			vi.spyOn(Iota, "getBalance").mockResolvedValue(0n);
			// Each call adds 1n; 10 retries yield 10n total, still below 100n
			vi.spyOn(Iota, "fundAddress").mockResolvedValue(1n);

			const promise = Iota.ensureBalance(
				TEST_CONFIG,
				TEST_FAUCET_ENDPOINT,
				TEST_IDENTITY,
				TEST_ADDRESS,
				100n
			);
			await vi.runAllTimersAsync();

			expect(await promise).toBe(false);
			expect(Iota.fundAddress).toHaveBeenCalledTimes(10);
		});

		test.skip("funds the test address to at least 1 IOTA via the real faucet", async () => {
			const vault = await vaultWithMnemonic();
			const addressIndex = Math.floor(Math.random() * 1000);
			const [address] = await Iota.getAddresses(
				vault,
				TEST_CONFIG,
				TEST_IDENTITY,
				0,
				addressIndex,
				1
			);
			console.debug(
				"Test Address",
				`${TEST_EXPLORER_URL}address/${address}?network=${TEST_NETWORK}`
			);

			const result = await Iota.ensureBalance(
				TEST_CONFIG,
				TEST_FAUCET_ENDPOINT,
				TEST_IDENTITY,
				address,
				1_000_000_000n
			);

			expect(result).toBe(true);
		});
	});

	describe("concurrent transactions (live, non gas station)", () => {
		const CONCURRENCY = 6;

		// Fires concurrent direct-path transactions that all pin the SAME small gas coin, and asserts
		// the issue #90 contract: each either succeeds, fails with the clear retryable
		// objectReservationConflict, or hits the documented non-retryable equivocation case; never
		// the opaque transactionFailed for a conflict. The contention is deliberately scoped to one
		// small explicitly-pinned coin: auto gas selection would take the address's ENTIRE coin
		// inventory into the race, and a lock-splitting round could leave the shared address unusable
		// until the epoch changes. Success is NOT guaranteed under genuine contention (validator
		// locks can split so no transaction reaches quorum), so no minimum success count is
		// asserted. Detection and retry internals are guarded by the network-free unit tests above.
		test("each concurrent transaction succeeds or returns the clear reservation error", async () => {
			const vault = createVault();
			await Iota.storeMnemonic(vault, TEST_CONFIG, TEST_IDENTITY, TEST_MNEMONIC, 0);
			const client = Iota.createClient(TEST_CONFIG);
			const [address] = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1);

			// Pick the smallest coin that can still pay gas; best effort split one off first when
			// only the primary coin qualifies, so the primary stays out of the blast radius.
			const minGasBalance = 200000000n;
			let coins = await client.getCoins({ owner: address });
			let candidates = coins.data.filter(c => BigInt(c.balance) >= minGasBalance);
			if (candidates.length <= 1) {
				try {
					await Iota.prepareAndPostValueTransaction(
						TEST_CONFIG,
						vault,
						undefined,
						TEST_IDENTITY,
						client,
						address,
						1000000000n,
						address
					);
					coins = await client.getCoins({ owner: address });
					candidates = coins.data.filter(c => BigInt(c.balance) >= minGasBalance);
				} catch {
					// The wallet may be temporarily locked; fall back to whatever qualifies.
				}
			}
			expect(candidates.length).toBeGreaterThan(0);
			const sortedCandidates = [...candidates].sort((a, b) =>
				Number(BigInt(a.balance) - BigInt(b.balance))
			);
			const gasCoin = sortedCandidates[0];

			const results = await Promise.allSettled(
				// The split amount varies by index so each transaction has a DISTINCT digest; identical
				// bytes would be a single digest submitted six times, which validators deduplicate
				// rather than treat as an owned-object conflict.
				Array.from({ length: CONCURRENCY }, async (element, index) => {
					const txb = new Transaction();
					txb.setGasPayment([
						{ objectId: gasCoin.coinObjectId, version: gasCoin.version, digest: gasCoin.digest }
					]);
					const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(index + 1)]);
					txb.transferObjects([coin], txb.pure.address(address));
					return Iota.prepareAndPostTransaction(
						TEST_CONFIG,
						vault,
						undefined,
						TEST_IDENTITY,
						client,
						address,
						txb
					);
				})
			);

			expect(results).toHaveLength(CONCURRENCY);
			for (const result of results) {
				if (result.status === "rejected") {
					// A conflict must surface as the clear error, or be the documented non-retryable
					// equivocation case; never the opaque transactionFailed wrapping a conflict.
					const isClearConflict = BaseError.someErrorMessage(
						result.reason,
						/objectReservationConflict/
					);
					const isEquivocated = BaseError.someErrorMessage(
						result.reason,
						/equivocated until the next epoch/
					);
					expect(isClearConflict || isEquivocated).toBe(true);
				}
			}
		});
	});

	describe("gas station helpers", () => {
		const GAS_STATION: IIotaConfig["gasStation"] = {
			gasStationUrl: "http://localhost:9527",
			gasStationAuthToken: "token"
		};

		test("isGasStationEnabled is true only when url and token are both set", () => {
			expect(Iota.isGasStationEnabled(TEST_CONFIG)).toBe(false);
			expect(Iota.isGasStationEnabled({ ...TEST_CONFIG, gasStation: GAS_STATION })).toBe(true);
			expect(
				Iota.isGasStationEnabled({
					...TEST_CONFIG,
					gasStation: { gasStationUrl: "", gasStationAuthToken: "token" }
				})
			).toBe(false);
			expect(
				Iota.isGasStationEnabled({
					...TEST_CONFIG,
					gasStation: { gasStationUrl: "http://localhost:9527", gasStationAuthToken: "" }
				})
			).toBe(false);
		});

		test("buildGasStationParams applies the reservation defaults and trims the url", () => {
			const params = Iota.buildGasStationParams({
				...TEST_CONFIG,
				gasStation: { ...GAS_STATION, gasStationUrl: "http://localhost:9527/" }
			});
			expect(params.gasStationUrl).toBe("http://localhost:9527");
			expect(params.gasStationAuthToken).toBe("token");
			expect(params.gasBudget).toBe(50000000);
			expect(params.gasReservationDuration).toBe(60);
		});

		test("buildGasStationParams honours configured budget and duration", () => {
			const params = Iota.buildGasStationParams({
				...TEST_CONFIG,
				gasBudget: 123456789,
				gasReservationDuration: 30,
				gasStation: GAS_STATION
			});
			expect(params.gasBudget).toBe(123456789);
			expect(params.gasReservationDuration).toBe(30);
		});

		test("buildGasStationParams throws without gas station config", () => {
			expect(() => Iota.buildGasStationParams(TEST_CONFIG)).toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.objectUndefined"
				})
			);
		});

		test("wrapGasStationError wraps with the standard error key", () => {
			const wrapped = Iota.wrapGasStationError(new Error("boom"));
			expect(wrapped.name).toBe("GeneralError");
			expect(wrapped.message).toBe("iota.gasStationTransactionFailed");
		});

		describe("checkGasStationConnectivity", () => {
			afterEach(() => {
				vi.restoreAllMocks();
			});

			test("throws when gas station is not configured", async () => {
				await expect(Iota.checkGasStationConnectivity(TEST_CONFIG)).rejects.toEqual(
					expect.objectContaining({
						name: "GuardError",
						message: "guard.objectUndefined"
					})
				);
			});

			test("throws when gas station url is empty", async () => {
				await expect(
					Iota.checkGasStationConnectivity({
						...TEST_CONFIG,
						gasStation: { gasStationUrl: "", gasStationAuthToken: "token" }
					})
				).rejects.toEqual(
					expect.objectContaining({
						name: "GuardError",
						message: "guard.stringEmpty"
					})
				);
			});

			test("returns true when the gas station responds with OK", async () => {
				vi.spyOn(FetchHelper, "fetch").mockResolvedValue(new Response("OK", { status: 200 }));

				const result = await Iota.checkGasStationConnectivity({
					...TEST_CONFIG,
					gasStation: GAS_STATION
				});
				expect(result).toBe(true);
			});

			test("returns false when the response body is not OK", async () => {
				vi.spyOn(FetchHelper, "fetch").mockResolvedValue(
					new Response("Service Unavailable", { status: 200 })
				);

				const result = await Iota.checkGasStationConnectivity({
					...TEST_CONFIG,
					gasStation: GAS_STATION
				});
				expect(result).toBe(false);
			});

			test("returns false when the response status is not ok", async () => {
				vi.spyOn(FetchHelper, "fetch").mockResolvedValue(new Response("OK", { status: 500 }));

				const result = await Iota.checkGasStationConnectivity({
					...TEST_CONFIG,
					gasStation: GAS_STATION
				});
				expect(result).toBe(false);
			});

			test("returns false when fetch throws", async () => {
				vi.spyOn(FetchHelper, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

				const result = await Iota.checkGasStationConnectivity({
					...TEST_CONFIG,
					gasStation: GAS_STATION
				});
				expect(result).toBe(false);
			});

			test("strips trailing slashes from the url before fetching", async () => {
				const fetchSpy = vi
					.spyOn(FetchHelper, "fetch")
					.mockResolvedValue(new Response("OK", { status: 200 }));

				await Iota.checkGasStationConnectivity({
					...TEST_CONFIG,
					gasStation: { gasStationUrl: "http://localhost:9527/", gasStationAuthToken: "token" }
				});
				expect(fetchSpy).toHaveBeenCalledWith("Iota", "http://localhost:9527", "GET");
			});
		});

		describe("checkGasStationIsWorking", () => {
			test("throws when gas station is not configured", async () => {
				await expect(Iota.checkGasStationIsWorking(TEST_CONFIG)).rejects.toEqual(
					expect.objectContaining({
						name: "GuardError",
						message: "guard.objectUndefined"
					})
				);
			});
		});
	});
});
