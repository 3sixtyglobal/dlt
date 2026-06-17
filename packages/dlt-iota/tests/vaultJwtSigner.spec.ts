// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
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
import { VaultJwtSigner } from "../src/vaultJwtSigner.js";

const TEST_IDENTITY = "test-identity";
const TEST_CONFIG: IIotaConfig = { clientOptions: TEST_CLIENT_OPTIONS, network: TEST_NETWORK };

let keyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
let secretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

describe("VaultJwtSigner", () => {
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

	async function vaultWithMnemonic(): Promise<IVaultConnector> {
		const vault = new EntityStorageVaultConnector();
		await vault.setSecret(`${TEST_IDENTITY}/mnemonic`, TEST_MNEMONIC);
		return vault;
	}

	describe("create", () => {
		test("returns an object with the StorageSigner interface", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(typeof signer.sign).toBe("function");
			expect(typeof signer.keyId).toBe("function");
			expect(typeof signer.publicKey).toBe("function");
			expect(typeof signer.iotaPublicKeyBytes).toBe("function");
			expect(typeof signer.asJwsSigner).toBe("function");
		});

		test("keyId returns the correct vault key name for index 0", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			expect(signer.keyId()).toBe(`${TEST_IDENTITY}/account/0/0/0`);
		});

		test("keyId reflects account and address indices", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, 1, 3);
			expect(signer.keyId()).toBe(`${TEST_IDENTITY}/account/1/0/3`);
		});

		test("publicKey returns an Ed25519PublicKey with 32-byte raw key", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const pk = await signer.publicKey();
			expect(pk.toRawBytes()).toHaveLength(32);
		});

		test("iotaPublicKeyBytes returns 33 bytes with Ed25519 flag 0 prefix", async () => {
			const vault = await vaultWithMnemonic();
			const signer = await VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const bytes = await signer.iotaPublicKeyBytes();
			expect(bytes).toHaveLength(33);
			expect(bytes[0]).toBe(0);
		});

		test("public key matches the address from getAddresses", async () => {
			const vault = await vaultWithMnemonic();
			const [expectedAddress] = await Iota.getAddresses(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0, 1);
			const signer = await VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, 0, 0);
			const pk = await signer.publicKey();
			expect(Iota.publicKeyToAddress(pk.toRawBytes())).toBe(expectedAddress);
		});

		// StorageSigner.sign() requires valid BCS-encoded TransactionData, which needs a real
		// IOTA node to build. The signing delegation is covered by vaultJwkStorage.spec.ts.

		test("throws GuardError for null vaultConnector", async () => {
			await expect(
				VaultJwtSigner.create(null as unknown as IVaultConnector, TEST_CONFIG, TEST_IDENTITY, 0, 0)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.object",
					source: "VaultJwtSigner",
					properties: { property: "vaultConnector", value: null }
				})
			);
		});

		test("throws GuardError for empty identity", async () => {
			const vault = await vaultWithMnemonic();
			await expect(VaultJwtSigner.create(vault, TEST_CONFIG, "", 0, 0)).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.stringEmpty",
					source: "VaultJwtSigner",
					properties: { property: "identity", value: "" }
				})
			);
		});

		test("throws GuardError for non-integer accountIndex", async () => {
			const vault = await vaultWithMnemonic();
			await expect(
				VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, Number.NaN, 0)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "VaultJwtSigner",
					properties: { property: "accountIndex", value: Number.NaN, options: undefined }
				})
			);
		});

		test("throws GuardError for non-integer addressIndex", async () => {
			const vault = await vaultWithMnemonic();
			await expect(
				VaultJwtSigner.create(vault, TEST_CONFIG, TEST_IDENTITY, 0, Number.NaN)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					message: "guard.integer",
					source: "VaultJwtSigner",
					properties: { property: "addressIndex", value: Number.NaN, options: undefined }
				})
			);
		});
	});
});
