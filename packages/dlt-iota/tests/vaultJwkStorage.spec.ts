// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { Jwk } from "@iota/identity-wasm/node/index.js";
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
import { VaultKeyType } from "@twin.org/vault-models";
import { TEST_MNEMONIC } from "./setupTestEnv.js";
import { Iota } from "../src/iota.js";
import { VaultJwkStorage } from "../src/vaultJwkStorage.js";

const TEST_IDENTITY = "test-identity";
const TEST_KEY_NAME = `${TEST_IDENTITY}/account/0/0/0`;
const TEST_SEED = Bip39.mnemonicToSeed(TEST_MNEMONIC);
const TEST_KEY_PAIR = Bip44.keyPair(
	TEST_SEED,
	KeyType.Ed25519,
	Iota.DEFAULT_COIN_TYPE,
	0,
	false,
	0
);

// VaultJwkStorage.sign ignores the publicKey parameter — a null stand-in is sufficient.
const NULL_JWK = null as unknown as Jwk;

let keyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
let secretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

describe("VaultJwkStorage", () => {
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

	async function createStorage(): Promise<{
		vault: EntityStorageVaultConnector;
		storage: VaultJwkStorage;
	}> {
		const vault = new EntityStorageVaultConnector();
		await vault.addKey(
			TEST_KEY_NAME,
			VaultKeyType.Ed25519,
			TEST_KEY_PAIR.privateKey,
			TEST_KEY_PAIR.publicKey
		);
		return { vault, storage: new VaultJwkStorage(vault, TEST_KEY_NAME) };
	}

	describe("insert", () => {
		test("returns the vault key name as the stable key ID", async () => {
			const { storage } = await createStorage();
			expect(await storage.insert(NULL_JWK)).toBe(TEST_KEY_NAME);
		});
	});

	describe("exists", () => {
		test("returns true for the vault key name", async () => {
			const { storage } = await createStorage();
			expect(await storage.exists(TEST_KEY_NAME)).toBe(true);
		});

		test("returns false for any other key ID", async () => {
			const { storage } = await createStorage();
			expect(await storage.exists("other-key-id")).toBe(false);
		});
	});

	describe("sign", () => {
		test("returns 64 raw signature bytes", async () => {
			const { storage } = await createStorage();
			const result = await storage.sign(TEST_KEY_NAME, new Uint8Array(32).fill(1), NULL_JWK);
			expect(result).toHaveLength(64);
		});

		test("is deterministic for the same input", async () => {
			const { storage } = await createStorage();
			const bytes = new Uint8Array(32).fill(1);
			const sig1 = await storage.sign(TEST_KEY_NAME, bytes, NULL_JWK);
			const sig2 = await storage.sign(TEST_KEY_NAME, bytes, NULL_JWK);
			expect(sig1).toEqual(sig2);
		});

		test("produces different signatures for different data", async () => {
			const { storage } = await createStorage();
			const sig1 = await storage.sign(TEST_KEY_NAME, new Uint8Array(32).fill(1), NULL_JWK);
			const sig2 = await storage.sign(TEST_KEY_NAME, new Uint8Array(32).fill(2), NULL_JWK);
			expect(sig1).not.toEqual(sig2);
		});

		test("ignores the keyId parameter and always uses the vault key", async () => {
			const { storage } = await createStorage();
			const bytes = new Uint8Array(32).fill(1);
			const sigWithCorrectId = await storage.sign(TEST_KEY_NAME, bytes, NULL_JWK);
			const sigWithOtherId = await storage.sign("ignored-key-id", bytes, NULL_JWK);
			expect(sigWithCorrectId).toEqual(sigWithOtherId);
		});
	});

	describe("generate", () => {
		test("throws GeneralError", async () => {
			const { storage } = await createStorage();
			await expect(storage.generate("OKP", "EdDSA" as never)).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					source: "VaultJwkStorage",
					message: "vaultJwkStorage.generateNotSupported"
				})
			);
		});
	});

	describe("delete", () => {
		test("resolves without error (no-op)", async () => {
			const { storage } = await createStorage();
			await expect(storage.delete(TEST_KEY_NAME)).resolves.toBeUndefined();
		});
	});
});
