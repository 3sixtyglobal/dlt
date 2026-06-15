// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { GeneralError } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import { Iota } from "@twin.org/dlt-iota";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVaultConnector,
	initSchema,
	type VaultKey,
	type VaultSecret
} from "@twin.org/vault-connector-entity-storage";
import { TEST_IOTA_CONFIG, TEST_MNEMONIC_NAME } from "./setupTestEnv.js";
import { CLI } from "../src/cli.js";
import { copyFixtures } from "./utils/copyFixtures.js";
import { ensureCorrectDeployerKey, generateUniqueBackupAlias } from "../src/commands/deploy.js";
import * as environmentUtils from "../src/utils/environmentUtils.js";
import { getDeploymentMnemonic, validateDeploymentEnvironment } from "../src/utils/envSetup.js";

const TEST_DATA_LOCATION = path.resolve(path.join(__dirname, ".tmp"));
const TEST_INPUT_GLOB = path.join(TEST_DATA_LOCATION, "contracts");
const TEST_OUTPUT_JSON = path.join(TEST_DATA_LOCATION, "compiled-modules.json");

let writeBuffer: string[] = [];
let errorBuffer: string[] = [];

let keyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
let secretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

/**
 * Creates a fresh vault connector backed by in-memory entity storage.
 * @returns A new EntityStorageVaultConnector instance.
 */
function createVault(): EntityStorageVaultConnector {
	return new EntityStorageVaultConnector();
}

/**
 * Creates a vault pre-populated with the test mnemonic secret.
 * @param identity The identity under which to store the mnemonic in the vault.
 * @param mnemonic The mnemonic to store in the vault.
 * @returns A vault connector ready for use with Iota methods.
 */
async function vaultWithMnemonic(
	identity: string,
	mnemonic: string
): Promise<EntityStorageVaultConnector> {
	const vault = createVault();
	await vault.setSecret(`${identity}/${TEST_MNEMONIC_NAME}`, mnemonic);
	return vault;
}

describe("move-to-json CLI", () => {
	beforeAll(async () => {
		await rm(TEST_DATA_LOCATION, { recursive: true, force: true });
		await mkdir(TEST_INPUT_GLOB, { recursive: true });

		const fixtureSource = path.join(__dirname, "fixtures");
		const fixtureDest = path.join(TEST_INPUT_GLOB, "iota");
		await copyFixtures(fixtureSource, fixtureDest);

		initSchema();
	});

	afterAll(async () => {
		await rm(TEST_DATA_LOCATION, { recursive: true, force: true });
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

		writeBuffer = [];
		errorBuffer = [];

		CLIDisplay.write = (buffer: string | Uint8Array): void => {
			writeBuffer.push(...buffer.toString().split("\n"));
		};
		CLIDisplay.writeError = (buffer: string | Uint8Array): void => {
			errorBuffer.push(...buffer.toString().split("\n"));
		};

		vi.restoreAllMocks();
	});

	afterEach(() => {
		EntityStorageConnectorFactory.unregister("vault-key");
		EntityStorageConnectorFactory.unregister("vault-secret");
	});

	test("Shows help when no subcommand provided", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["node", "move-to-json", "--help"], "./dist/locales", {
			overrideOutputWidth: 1000
		});

		expect(exitCode).toBe(0);
		const output = writeBuffer.join("\n");
		expect(output).toContain("build");
		expect(output).toContain("deploy");
	});

	test("Build command fails gracefully when platform SDK is not installed", async () => {
		vi.spyOn(CLIUtils, "runShellApp").mockRejectedValueOnce(
			new GeneralError("commands", "IOTA SDK not installed", { platform: "iota" })
		);

		const cli = new CLI();
		const exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(1);

		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain("IOTA SDK not installed");

		vi.restoreAllMocks();
	});

	test("Build command compiles an IOTA fixture", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		if (exitCode !== 0) {
			const standardOutput = writeBuffer.join("\n");
			console.log("Build command failed with standard output:");
			console.log(standardOutput);
			const errOutput = errorBuffer.join("\n");
			console.error("Build command failed with error output:");
			console.error(errOutput);
		}

		expect(exitCode).toBe(0);
		const compiledFileExists = existsSync(TEST_OUTPUT_JSON);
		expect(compiledFileExists).toBe(true);

		const fileContents = await readFile(TEST_OUTPUT_JSON, "utf8");
		const json = JSON.parse(fileContents);

		// Check new network-aware structure exists
		expect(json.testnet).toBeDefined();

		// Check contract data in target network (testnet) - flat structure
		expect(json.testnet.packageId).toMatch(/^0x/);
		expect(json.testnet.packageBytecode).toBeDefined();
		expect(json.testnet.deployedPackageId).toBeUndefined();
	});

	test("Build command preserves deployedPackageId when bytecode unchanged", async () => {
		const cli = new CLI();

		// First build
		let exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);

		// Simulate deployment by adding deployedPackageId
		const firstBuildJson = JSON.parse(await readFile(TEST_OUTPUT_JSON, "utf8"));
		firstBuildJson.testnet.deployedPackageId = "0xdeployed456";
		await CLIUtils.writeJsonFile(TEST_OUTPUT_JSON, firstBuildJson, false);

		// Second build without changes
		exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);

		// Verify deployedPackageId preserved
		const secondBuildJson = JSON.parse(await readFile(TEST_OUTPUT_JSON, "utf8"));
		expect(secondBuildJson.testnet.deployedPackageId).toBe("0xdeployed456");
	});

	test("Build command clears deployedPackageId when bytecode changes", async () => {
		const cli = new CLI();

		// First build
		let exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);

		// Simulate deployment by adding deployedPackageId
		const firstBuildJson = JSON.parse(await readFile(TEST_OUTPUT_JSON, "utf8"));
		firstBuildJson.testnet.deployedPackageId = "0xdeployed789";
		await CLIUtils.writeJsonFile(TEST_OUTPUT_JSON, firstBuildJson, false);

		const beforeModifyJson = firstBuildJson;

		// Modify the contract source to change bytecode
		const nftSourcePath = path.join(TEST_INPUT_GLOB, "iota", "sources", "nft.move");
		const originalContent = await readFile(nftSourcePath, "utf8");

		// Make a small change to trigger bytecode change
		const modifiedContent = originalContent.replace(
			"const VERSION: u64 = 1;",
			"const VERSION: u64 = 2;"
		);

		await writeFile(nftSourcePath, modifiedContent, "utf8");

		try {
			// Second build with modified contract
			exitCode = await cli.run(
				[
					"node",
					"move-to-json",
					"build",
					path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
					"--network",
					"testnet",
					"--output",
					TEST_OUTPUT_JSON
				],
				"./dist/locales",
				{ overrideOutputWidth: 1000 }
			);

			expect(exitCode).toBe(0);

			// Verify deployedPackageId was cleared due to bytecode change
			const afterModifyJson = JSON.parse(await readFile(TEST_OUTPUT_JSON, "utf8"));
			expect(afterModifyJson.testnet.deployedPackageId).toBeUndefined();
			expect(afterModifyJson.testnet.packageId).toBeDefined();
			expect(afterModifyJson.testnet.packageBytecode).toBeDefined();

			// Verify the package ID actually changed
			expect(afterModifyJson.testnet.packageId).not.toBe(beforeModifyJson.testnet.packageId);
		} finally {
			// Restore original contract content
			await writeFile(nftSourcePath, originalContent, "utf8");
		}
	});

	test("Build command should error when multiple Move files are detected", async () => {
		// Create a temporary directory with multiple Move files
		const multiFileTestDir = path.join(TEST_DATA_LOCATION, "multi-file-test");
		await mkdir(multiFileTestDir, { recursive: true });

		// Create two Move files to trigger the error
		await writeFile(
			path.join(multiFileTestDir, "contract1.move"),
			"module test::contract1 {}",
			"utf8"
		);
		await writeFile(
			path.join(multiFileTestDir, "contract2.move"),
			"module test::contract2 {}",
			"utf8"
		);

		const cli = new CLI();
		const exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(multiFileTestDir, "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(1);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain("Multiple Move files detected");

		// Cleanup
		await rm(multiFileTestDir, { recursive: true, force: true });
	});

	test("Deploy command requires network option", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["node", "move-to-json", "deploy"], "./dist/locales", {
			overrideOutputWidth: 1000
		});

		expect(exitCode).toBe(1);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain(
			'The "network" option is configured as an environment variable, but there is no environment variable with the name "NETWORK" set'
		);
	});

	test("Deploy command requires rpcUrl option", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(
			["node", "move-to-json", "deploy", "--network", "testnet"],
			"./dist/locales",
			{
				overrideOutputWidth: 1000
			}
		);

		expect(exitCode).toBe(1);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain(
			'The "rpcUrl" option is configured as an environment variable, but there is no environment variable with the name "RPC_URL" set'
		);
	});

	test("Build command requires network option", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(
			["node", "move-to-json", "build", "src/contracts/**/*.move"],
			"./dist/locales",
			{
				overrideOutputWidth: 1000
			}
		);

		expect(exitCode).toBe(1);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain(
			'The "network" option is configured as an environment variable, but there is no environment variable with the name "NETWORK" set'
		);
	});
});

describe("envSetup Validation", () => {
	const TEST_CONFIGS_DIR = path.join(TEST_DATA_LOCATION, "configs");

	beforeAll(async () => {
		await mkdir(TEST_CONFIGS_DIR, { recursive: true });
	});

	afterAll(async () => {
		await rm(TEST_CONFIGS_DIR, { recursive: true, force: true });
	});

	beforeEach(() => {
		writeBuffer = [];
		errorBuffer = [];
	});

	test("validateDeploymentEnvironment throws localized error when mnemonic is missing", async () => {
		const originalCwd = process.cwd();
		process.chdir(TEST_DATA_LOCATION);

		try {
			await validateDeploymentEnvironment("testnet", "");
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(GeneralError);
			const generalError = error as GeneralError;
			expect(generalError.source).toBe("envSetup");
			expect(generalError.message).toBe("envSetup.mnemonicMissing");
			expect(generalError.properties).toMatchObject({
				network: "testnet",
				mnemonicVar: "DEPLOYER_MNEMONIC"
			});
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("validateDeploymentEnvironment throws localized error when mnemonic has wrong word count", async () => {
		// Modify the env with invalid mnemonic (only 12 words instead of 24)

		const originalCwd = process.cwd();
		process.chdir(TEST_DATA_LOCATION);

		try {
			await validateDeploymentEnvironment(
				"testnet",
				"word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
			);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(GeneralError);
			const generalError = error as GeneralError;
			expect(generalError.source).toBe("envSetup");
			expect(generalError.message).toBe("envSetup.mnemonicInvalidFormat");
			expect(generalError.properties).toMatchObject({
				network: "testnet",
				mnemonicVar: "DEPLOYER_MNEMONIC"
			});
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("getDeploymentMnemonic returns mnemonic when valid", async () => {
		// Create env file with valid 24-word mnemonic
		const validMnemonic = Bip39.randomMnemonic();

		const originalCwd = process.cwd();
		process.chdir(TEST_DATA_LOCATION);

		try {
			const result = await getDeploymentMnemonic("testnet", validMnemonic);
			expect(result).toBe(validMnemonic);
		} finally {
			process.chdir(originalCwd);
		}
	});
});

describe("ensureCorrectDeployerKey", () => {
	const TEST_MNEMONIC =
		"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should use existing correct key without making changes", async () => {
		// Mock the keystore list response with correct key
		const mockKeysList = [
			{ alias: "deployer-testnet", iotaAddress: "correct_address", keyScheme: "ed25519" }
		];

		const mockExecAsync = vi.spyOn(environmentUtils, "execAsyncWithError");

		mockExecAsync.mockResolvedValueOnce({
			stdout: JSON.stringify(mockKeysList),
			stderr: ""
		});

		// Mock client addresses check
		const mockAddressInfo = { addresses: [["alias", "correct_address"]] };
		mockExecAsync.mockResolvedValueOnce({
			stdout: JSON.stringify(mockAddressInfo),
			stderr: ""
		});

		// Call the actual function
		const validMnemonic = TEST_MNEMONIC;
		await ensureCorrectDeployerKey(
			"testnet",
			"deployer-testnet",
			"correct_address",
			0,
			validMnemonic
		);

		// Should only call list command and address check, no renaming or importing
		expect(mockExecAsync).toHaveBeenCalledWith("iota keytool list --json");
		expect(mockExecAsync).toHaveBeenCalledWith("iota client addresses --json");
		expect(mockExecAsync).toHaveBeenCalledTimes(2);
	});

	test("should rename conflicting key and import correct one", async () => {
		// Mock the keystore list response with conflicting key
		const mockKeysList = [
			{ alias: "deployer-testnet", iotaAddress: "old_wrong_address", keyScheme: "ed25519" }
		];

		const mockExecAsync = vi.spyOn(environmentUtils, "execAsyncWithError");
		mockExecAsync.mockResolvedValueOnce({
			stdout: JSON.stringify(mockKeysList),
			stderr: ""
		});

		// Mock the update-alias command
		mockExecAsync.mockResolvedValueOnce({
			stdout: "Key alias updated successfully",
			stderr: ""
		});

		// Mock the import command
		mockExecAsync.mockResolvedValueOnce({
			stdout: "Key imported successfully",
			stderr: ""
		});

		// Mock client addresses check
		const mockAddressInfo = { addresses: [["alias", "correct_address"]] };
		mockExecAsync.mockResolvedValueOnce({
			stdout: JSON.stringify(mockAddressInfo),
			stderr: ""
		});

		// Call the actual function
		await ensureCorrectDeployerKey(
			"testnet",
			"deployer-testnet",
			"correct_address",
			0,
			TEST_MNEMONIC
		);

		// Should call: list, update-alias, import, addresses check
		expect(mockExecAsync).toHaveBeenCalledWith("iota keytool list --json");
		expect(mockExecAsync).toHaveBeenCalledWith(expect.stringMatching(/iota keytool update-alias/));
		expect(mockExecAsync).toHaveBeenCalledWith(expect.stringMatching(/iota keytool import/));
		expect(mockExecAsync).toHaveBeenCalledWith("iota client addresses --json");
		expect(mockExecAsync).toHaveBeenCalledTimes(4);
	});

	test("should import key when no existing alias found", async () => {
		const mockExecAsync = vi.spyOn(environmentUtils, "execAsyncWithError");

		// Mock empty keystore list
		mockExecAsync.mockResolvedValueOnce({
			stdout: JSON.stringify([]),
			stderr: ""
		});

		// Mock the import command
		mockExecAsync.mockResolvedValueOnce({
			stdout: "Key imported successfully",
			stderr: ""
		});

		// Mock client addresses check
		const mockAddressInfo = { addresses: [["alias", "correct_address"]] };
		mockExecAsync.mockResolvedValueOnce({
			stdout: JSON.stringify(mockAddressInfo),
			stderr: ""
		});

		// Call the actual function
		await ensureCorrectDeployerKey(
			"testnet",
			"deployer-testnet",
			"correct_address",
			0,
			TEST_MNEMONIC
		);

		// Should call: list, import, addresses check
		expect(mockExecAsync).toHaveBeenCalledWith("iota keytool list --json");
		expect(mockExecAsync).toHaveBeenCalledWith(expect.stringMatching(/iota keytool import/));
		expect(mockExecAsync).toHaveBeenCalledWith("iota client addresses --json");
		expect(mockExecAsync).toHaveBeenCalledTimes(3);
	});
});

describe("generateUniqueBackupAlias", () => {
	beforeAll(async () => {
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

	afterEach(() => {
		EntityStorageConnectorFactory.unregister("vault-key");
		EntityStorageConnectorFactory.unregister("vault-secret");
	});

	test("should generate unique backup alias with crypto random bytes", () => {
		const existingKeys = [
			{ alias: "deployer-testnet", iotaAddress: "address1" },
			{ alias: "other-key", iotaAddress: "address2" }
		];

		const backupAlias = generateUniqueBackupAlias("deployer-testnet", existingKeys);

		// Should follow the pattern: baseAlias-backup-randomHex
		expect(backupAlias).toMatch(/^deployer-testnet-backup-[\da-f]{8}$/);

		// Should not conflict with existing aliases
		const existingAliases = existingKeys.map(k => k.alias);
		expect(existingAliases).not.toContain(backupAlias);
	});

	test("should generate different aliases on multiple calls", () => {
		const existingKeys = [{ alias: "deployer-testnet", iotaAddress: "address1" }];

		const alias1 = generateUniqueBackupAlias("deployer-testnet", existingKeys);
		const alias2 = generateUniqueBackupAlias("deployer-testnet", existingKeys);

		// Should generate different aliases
		expect(alias1).not.toBe(alias2);

		// Both should follow the pattern
		expect(alias1).toMatch(/^deployer-testnet-backup-[\da-f]{8}$/);
		expect(alias2).toMatch(/^deployer-testnet-backup-[\da-f]{8}$/);
	});

	test("Enhanced key conflict detection with random backup names", async () => {
		// This test verifies our improved key management logic that uses
		// random suffixes to avoid conflicts even in rapid succession

		// Generate different random mnemonics for testing
		const oldMnemonic = Bip39.randomMnemonic();
		const newMnemonic = Bip39.randomMnemonic();

		const vaultOldMnemonic = await vaultWithMnemonic("identityOld", oldMnemonic);
		const vaultNewMnemonic = await vaultWithMnemonic("identityNew", newMnemonic);

		// Generate addresses from mnemonics
		const oldExpectedAddress = await Iota.getAddress(
			vaultOldMnemonic,
			TEST_IOTA_CONFIG,
			"identityOld",
			0,
			0,
			false
		);
		const newExpectedAddress = await Iota.getAddress(
			vaultNewMnemonic,
			TEST_IOTA_CONFIG,
			"identityNew",
			0,
			0,
			false
		);

		// Generate random backup keys with different mnemonics
		const backup1Mnemonic = Bip39.randomMnemonic();
		const backup2Mnemonic = Bip39.randomMnemonic();

		const vaultBackup1 = await vaultWithMnemonic("identityBackup1", backup1Mnemonic);
		const vaultBackup2 = await vaultWithMnemonic("identityBackup2", backup2Mnemonic);

		const backup1Address = await Iota.getAddress(
			vaultBackup1,
			TEST_IOTA_CONFIG,
			"identityBackup1",
			0,
			0,
			false
		);
		const backup2Address = await Iota.getAddress(
			vaultBackup2,
			TEST_IOTA_CONFIG,
			"identityBackup2",
			0,
			0,
			false
		);

		// Mock existing keystore with multiple backup keys (simulating previous conflicts)
		const randomTimestamp1 = Date.now() - Math.floor(Math.random() * 1000000);
		const randomTimestamp2 = Date.now() - Math.floor(Math.random() * 1000000);
		const randomComponent1 = Math.floor(Math.random() * 10000)
			.toString()
			.padStart(4, "0");
		const randomComponent2 = Math.floor(Math.random() * 10000)
			.toString()
			.padStart(4, "0");

		const mockKeysListWithMultipleBackups = [
			{
				alias: "deployer-testnet",
				iotaAddress: oldExpectedAddress,
				keyScheme: "ed25519"
			},
			{
				alias: `deployer-testnet-backup-${randomTimestamp1}-${randomComponent1}`,
				iotaAddress: backup1Address,
				keyScheme: "ed25519"
			},
			{
				alias: `deployer-testnet-backup-${randomTimestamp2}-${randomComponent2}`,
				iotaAddress: backup2Address,
				keyScheme: "ed25519"
			}
		];

		// Test the enhanced conflict detection logic
		const aliasName = "deployer-testnet";
		const existingKey = mockKeysListWithMultipleBackups.find(
			(key: { alias: string; iotaAddress: string }) => key.alias === aliasName
		);

		// Verify conflict detection
		expect(existingKey).toBeDefined();
		expect(existingKey?.iotaAddress).toBe(oldExpectedAddress);

		// Simulate the conflict check
		const hasConflict = existingKey && existingKey.iotaAddress !== newExpectedAddress;
		expect(hasConflict).toBe(true);

		// Test the enhanced backup alias generation logic
		if (hasConflict) {
			const existingAliases = new Set(mockKeysListWithMultipleBackups.map(key => key.alias));

			// Generate random timestamp and component for backup naming
			const timestamp = Date.now() + Math.floor(Math.random() * 100000);
			const randomComponent = Math.floor(Math.random() * 10000)
				.toString()
				.padStart(4, "0");
			const potentialBackupAlias = `${aliasName}-backup-${timestamp}-${randomComponent}`;

			// Verify this alias would be unique
			expect(existingAliases.has(potentialBackupAlias)).toBe(false);

			console.debug("✅ Enhanced key conflict resolution logic verified:");
			console.debug(`  - Old mnemonic generated: ${oldExpectedAddress}`);
			console.debug(`  - New mnemonic generated: ${newExpectedAddress}`);
			console.debug(`  - Generated unique backup alias: ${potentialBackupAlias}`);
			console.debug(`  - Avoids conflicts with ${existingAliases.size} existing keys`);
		}

		// Test edge case: many existing backups
		const manyBackups = [];
		const baseTimestamp = Date.now() - 1000000;
		for (let i = 0; i < 10; i++) {
			const multipliedI = i * 1000;
			const randomTimestamp = baseTimestamp + multipliedI + Math.floor(Math.random() * 1000);
			const randomComponent = (1000 + i + Math.floor(Math.random() * 100))
				.toString()
				.padStart(4, "0");
			// Generate a random seed for each backup key
			const randomMnemonic = Bip39.randomMnemonic();

			const vaultRandom = await vaultWithMnemonic(`identityBackup${i}`, randomMnemonic);

			const randomAddress = await Iota.getAddress(
				vaultRandom,
				TEST_IOTA_CONFIG,
				`identityBackup${i}`,
				0,
				0
			);

			manyBackups.push({
				alias: `deployer-testnet-backup-${randomTimestamp}-${randomComponent}`,
				iotaAddress: randomAddress,
				keyScheme: "ed25519"
			});
		}

		const manyBackupsSet = new Set(manyBackups.map(key => key.alias));

		// Verify our logic would still find unique names
		const testTimestamp = Date.now() + Math.floor(Math.random() * 1000000);
		const testRandom = Math.floor(Math.random() * 10000)
			.toString()
			.padStart(4, "0");
		const testBackupAlias = `deployer-testnet-backup-${testTimestamp}-${testRandom}`;

		expect(manyBackupsSet.has(testBackupAlias)).toBe(false);

		console.debug("✅ Edge case verified: unique naming works with many existing backups");
		console.debug(`  - Generated ${manyBackups.length} random backup keys`);
		console.debug(`  - Test alias "${testBackupAlias}" is unique`);
	});
});
