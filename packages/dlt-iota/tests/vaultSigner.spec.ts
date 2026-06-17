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
import { VaultSigner } from "../src/vaultSigner.js";

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

describe("VaultSigner", () => {
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

	async function createSigner(): Promise<VaultSigner> {
		const vault = new EntityStorageVaultConnector();
		await vault.addKey(
			TEST_KEY_NAME,
			VaultKeyType.Ed25519,
			TEST_KEY_PAIR.privateKey,
			TEST_KEY_PAIR.publicKey
		);
		return new VaultSigner(vault, TEST_KEY_NAME, TEST_KEY_PAIR.publicKey);
	}

	test("getKeyScheme returns ED25519", async () => {
		const signer = await createSigner();
		expect(signer.getKeyScheme()).toBe("ED25519");
	});

	test("getPublicKey returns Ed25519PublicKey with the correct raw bytes", async () => {
		const signer = await createSigner();
		expect(signer.getPublicKey().toRawBytes()).toEqual(TEST_KEY_PAIR.publicKey);
	});

	test("getPublicKey carries Ed25519 flag byte 0", async () => {
		const signer = await createSigner();
		expect(signer.getPublicKey().flag()).toBe(0);
	});

	test("sign returns 64 raw signature bytes", async () => {
		const signer = await createSigner();
		const signature = await signer.sign(new Uint8Array(32).fill(1));
		expect(signature).toHaveLength(64);
	});

	test("sign is deterministic for the same input", async () => {
		const signer = await createSigner();
		const bytes = new Uint8Array(32).fill(1);
		expect(await signer.sign(bytes)).toEqual(await signer.sign(bytes));
	});

	test("sign produces different signatures for different inputs", async () => {
		const signer = await createSigner();
		const sigA = await signer.sign(new Uint8Array(32).fill(1));
		const sigB = await signer.sign(new Uint8Array(32).fill(2));
		expect(sigA).not.toEqual(sigB);
	});
});
