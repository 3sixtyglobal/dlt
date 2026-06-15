// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClient } from "@iota/iota-sdk/client";
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
import { IotaSmartContractUtils } from "../src/iotaSmartContractUtils.js";
import {
	TEST_IDENTITY,
	TEST_NAMESPACE,
	testDeploymentConfig
} from "./fixtures/testDeploymentConfig.js";
import { TEST_CLIENT_OPTIONS, TEST_MNEMONIC, TEST_NETWORK } from "./setupTestEnv.js";
import type { IIotaConfig } from "../src/models/IIotaConfig.js";

const MOCK_PACKAGE_ID = "0x1234567890abcdef1234567890abcdef12345678";

const mockVersionExtractor = (content: { fields?: { version?: number } }): number =>
	content?.fields?.version ?? 0;

describe("IotaSmartContractUtils - Phase 2 Methods", () => {
	const testConfig: IIotaConfig = {
		clientOptions: TEST_CLIENT_OPTIONS,
		network: TEST_NETWORK,
		enableCostLogging: false
	};

	const mockClient = {
		devInspectTransactionBlock: vi.fn(),
		getObject: vi.fn(),
		getOwnedObjects: vi.fn(),
		queryTransactionBlocks: vi.fn()
	};

	let keyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
	let secretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

	function createVault(): EntityStorageVaultConnector {
		return new EntityStorageVaultConnector();
	}

	async function vaultWithMnemonic(): Promise<IVaultConnector> {
		const vault = createVault();
		await vault.setSecret(`${TEST_IDENTITY}/mnemonic`, TEST_MNEMONIC);
		return vault;
	}

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

		vi.clearAllMocks();

		mockClient.getOwnedObjects.mockResolvedValue({
			data: [
				{
					data: {
						objectId: "0xadmincap123456789abcdef1234567890abcdef12",
						version: "1",
						digest: "DigestHash123"
					}
				}
			],
			hasNextPage: false
		});
	});

	afterEach(async () => {
		await keyEntityStorage.teardown();
		await secretEntityStorage.teardown();
		EntityStorageConnectorFactory.unregister("vault-key");
		EntityStorageConnectorFactory.unregister("vault-secret");
	});

	describe("getCurrentContractVersion", () => {
		test("can get current contract version", async () => {
			mockClient.devInspectTransactionBlock.mockResolvedValue({
				results: [
					{
						returnValues: [
							[new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0])] // BCS encoded u64 value: 1
						]
					}
				],
				effects: { status: { status: "success" as const } },
				events: []
			});

			const vaultConnector = await vaultWithMnemonic();
			const version = await IotaSmartContractUtils.getCurrentContractVersion(
				testConfig,
				mockClient as unknown as IotaClient,
				vaultConnector,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				TEST_IDENTITY
			);

			expect(version).toBe(1);
			expect(mockClient.devInspectTransactionBlock).toHaveBeenCalled();
		});

		test("throws error when no version data returned", async () => {
			mockClient.devInspectTransactionBlock.mockResolvedValue({ results: [] });

			const vaultConnector = await vaultWithMnemonic();
			await expect(
				IotaSmartContractUtils.getCurrentContractVersion(
					testConfig,
					mockClient as unknown as IotaClient,
					vaultConnector,
					TEST_NAMESPACE,
					MOCK_PACKAGE_ID,
					TEST_IDENTITY
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					source: "IotaSmartContractUtils",
					message: "iotaSmartContractUtils.getCurrentContractVersionFailed"
				})
			);
		});
	});

	describe("validateObjectVersion", () => {
		test("can validate object version", async () => {
			mockClient.devInspectTransactionBlock.mockResolvedValue({
				results: [
					{
						returnValues: [
							[new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0])] // Contract version: 1
						]
					}
				],
				effects: { status: { status: "success" as const } },
				events: []
			});
			mockClient.getObject.mockResolvedValue({
				data: {
					objectId: "0x9876543210fedcba9876543210fedcba98765432",
					version: "1",
					digest: "AoZh3hs5Y6z6fmSJZZUksZBPVXYksLpJLstSPCLSKgKF",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::TestObject",
						fields: { version: 1 }
					}
				}
			});

			const vaultConnector = await vaultWithMnemonic();
			const isValid = await IotaSmartContractUtils.validateObjectVersion(
				testConfig,
				mockClient as unknown as IotaClient,
				vaultConnector,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				TEST_IDENTITY,
				"0x9876543210fedcba9876543210fedcba98765432",
				mockVersionExtractor
			);

			expect(isValid).toBe(true);
			expect(mockClient.devInspectTransactionBlock).toHaveBeenCalled();
			expect(mockClient.getObject).toHaveBeenCalled();
		});

		test("returns false when object version is newer than contract", async () => {
			mockClient.devInspectTransactionBlock.mockResolvedValue({
				results: [
					{
						returnValues: [
							[new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0])] // Contract version: 1
						]
					}
				],
				effects: { status: { status: "success" as const } },
				events: []
			});
			mockClient.getObject.mockResolvedValue({
				data: {
					objectId: "0x9876543210fedcba9876543210fedcba98765432",
					version: "1",
					digest: "AoZh3hs5Y6z6fmSJZZUksZBPVXYksLpJLstSPCLSKgKF",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::TestObject",
						fields: { version: 2 } // Newer than contract version (1)
					}
				}
			});

			const vaultConnector = await vaultWithMnemonic();
			const isValid = await IotaSmartContractUtils.validateObjectVersion(
				testConfig,
				mockClient as unknown as IotaClient,
				vaultConnector,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				TEST_IDENTITY,
				"0x9876543210fedcba9876543210fedcba98765432",
				mockVersionExtractor
			);

			expect(isValid).toBe(false);
		});
	});

	describe("isMigrationActive", () => {
		test("returns true when migration is enabled", async () => {
			mockClient.getObject.mockResolvedValue({
				data: {
					objectId: "0x1234567890abcdef1234567890abcdef12345678",
					version: "1",
					digest: "DigestHash123",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::MigrationState",
						fields: { enabled: true }
					}
				}
			});

			const vaultConnector = await vaultWithMnemonic();
			const isActive = await IotaSmartContractUtils.isMigrationActive(
				testConfig,
				mockClient as unknown as IotaClient,
				vaultConnector,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				testDeploymentConfig,
				TEST_IDENTITY
			);

			expect(isActive).toBe(true);
			expect(mockClient.getObject).toHaveBeenCalled();
		});

		test("returns false when migration is disabled", async () => {
			mockClient.getObject.mockResolvedValue({
				data: {
					objectId: "0x1234567890abcdef1234567890abcdef12345678",
					version: "1",
					digest: "DigestHash123",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::MigrationState",
						fields: { enabled: false }
					}
				}
			});

			const vaultConnector = await vaultWithMnemonic();
			const isActive = await IotaSmartContractUtils.isMigrationActive(
				testConfig,
				mockClient as unknown as IotaClient,
				vaultConnector,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				testDeploymentConfig,
				TEST_IDENTITY
			);

			expect(isActive).toBe(false);
			expect(mockClient.getObject).toHaveBeenCalled();
		});

		test("throws error when migration state not found", async () => {
			mockClient.getObject.mockResolvedValue({ data: null });

			const vaultConnector = await vaultWithMnemonic();
			await expect(
				IotaSmartContractUtils.isMigrationActive(
					testConfig,
					mockClient as unknown as IotaClient,
					vaultConnector,
					TEST_NAMESPACE,
					MOCK_PACKAGE_ID,
					testDeploymentConfig,
					TEST_IDENTITY
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					source: "IotaSmartContractUtils"
				})
			);
		});
	});
});
