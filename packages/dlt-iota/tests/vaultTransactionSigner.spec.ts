// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
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
import { VaultTransactionSigner } from "../src/vaultTransactionSigner.js";

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

let keyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
let secretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

describe("VaultTransactionSigner", () => {
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

	async function createSigner(): Promise<VaultTransactionSigner> {
		const vault = new EntityStorageVaultConnector();
		await vault.addKey(
			TEST_KEY_NAME,
			VaultKeyType.Ed25519,
			TEST_KEY_PAIR.privateKey,
			TEST_KEY_PAIR.publicKey
		);
		return new VaultTransactionSigner(vault, TEST_KEY_NAME, TEST_KEY_PAIR.publicKey);
	}

	test("keyId returns the vault key name", async () => {
		const signer = await createSigner();
		expect(signer.keyId()).toBe(TEST_KEY_NAME);
	});

	test("publicKey returns Ed25519PublicKey with correct 32-byte raw key", async () => {
		const signer = await createSigner();
		const pk = await signer.publicKey();
		expect(pk.toRawBytes()).toEqual(TEST_KEY_PAIR.publicKey);
		expect(pk.toRawBytes()).toHaveLength(32);
	});

	test("iotaPublicKeyBytes returns 33 bytes with Ed25519 flag 0 prefix", async () => {
		const signer = await createSigner();
		const bytes = await signer.iotaPublicKeyBytes();
		expect(bytes).toHaveLength(33);
		expect(bytes[0]).toBe(0);
		expect(bytes.slice(1)).toEqual(TEST_KEY_PAIR.publicKey);
	});

	test("sign returns a base64 string decoding to 97 bytes", async () => {
		const signer = await createSigner();
		const signature = await signer.sign(new Uint8Array(64).fill(1));
		expect(typeof signature).toBe("string");
		expect(Buffer.from(signature, "base64")).toHaveLength(97);
	});

	test("sign scheme flag byte is 0 (Ed25519)", async () => {
		const signer = await createSigner();
		const signature = await signer.sign(new Uint8Array(64).fill(1));
		expect(Buffer.from(signature, "base64")[0]).toBe(0);
	});

	test("sign is deterministic for the same input", async () => {
		const signer = await createSigner();
		const txBytes = new Uint8Array(64).fill(1);
		expect(await signer.sign(txBytes)).toBe(await signer.sign(txBytes));
	});

	test("sign produces different signatures for different inputs", async () => {
		const signer = await createSigner();
		const sigA = await signer.sign(new Uint8Array(64).fill(1));
		const sigB = await signer.sign(new Uint8Array(64).fill(2));
		expect(sigA).not.toBe(sigB);
	});
});
