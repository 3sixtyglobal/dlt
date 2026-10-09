// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ISmartContractDeployments } from "@3sixty/dlt-iota";
import {
	TEST_NETWORK,
	TEST_CONTRACT_PATH_V1,
	createTempEnvConfig,
	TEST_NODE_ENDPOINT,
	TEST_FAUCET_ENDPOINT,
	TEST_DEPLOYER_MNEMONIC,
	TEST_GAS_BUDGET,
	TEST_GAS_STATION_URL,
	TEST_GAS_STATION_AUTH_TOKEN,
	setupTestEnv,
	cleanupTestEnv
} from "./setupTestEnv.js";
import { CLI } from "../src/cli.js";
import { cleanBuildArtifactsInPath } from "../src/utils/buildArtifactUtils.js";

const TEST_UPGRADE_CHAIN_JSON = path.join(__dirname, ".tmp", "upgrade-chain-test.json");
const ORIGINAL_PACKAGE_ID = "0xaaaa000000000000000000000000000000000000000000000000000000000001";
const UPGRADED_PACKAGE_ID = "0xbbbb000000000000000000000000000000000000000000000000000000000002";
const UPGRADE_CAP_ID = "0xcccc000000000000000000000000000000000000000000000000000000000003";
const MIGRATION_STATE_ID = "0xdddd000000000000000000000000000000000000000000000000000000000004";

describe("Build Upgrade Chain Preservation", () => {
	beforeAll(async () => {
		console.debug("Setting up upgrade chain test environment");
		await setupTestEnv();
		await mkdir(path.dirname(TEST_UPGRADE_CHAIN_JSON), { recursive: true });
		console.debug("Upgrade chain test environment setup completed");
	}, 300000);

	afterAll(async () => {
		console.debug("Cleaning up upgrade chain test environment");
		await cleanupTestEnv();
		try {
			await rm(TEST_UPGRADE_CHAIN_JSON, { force: true });
		} catch {
			// Ignore cleanup errors
		}
		console.debug("Upgrade chain test environment cleanup completed");
	});

	describe("First build after initial deployment", () => {
		it("should set lastDeployedPackageId from deployedPackageId on bytecode change", async () => {
			// Simulate state after initial deployment: deployedPackageId is set, no lastDeployedPackageId
			const initialState: ISmartContractDeployments = {
				[TEST_NETWORK]: {
					packageId: "0x0000000000000000000000000000000000000000000000000000000000000000",
					packageBytecode: "",
					deployedPackageId: ORIGINAL_PACKAGE_ID,
					upgradeCapabilityId: UPGRADE_CAP_ID,
					migrationStateId: MIGRATION_STATE_ID
				}
			};
			await writeFile(TEST_UPGRADE_CHAIN_JSON, JSON.stringify(initialState, null, "\t"));

			// Build the contract - bytecode will differ from the fake packageId, triggering upgrade chain logic
			await runBuild();

			const result = await loadJson(TEST_UPGRADE_CHAIN_JSON);
			const contractData = result[TEST_NETWORK as keyof ISmartContractDeployments];

			// deployedPackageId should be cleared (signals upgrade needed)
			expect(contractData?.deployedPackageId).toBeUndefined();
			// lastDeployedPackageId should be set to the original deployment
			expect(contractData?.lastDeployedPackageId).toBe(ORIGINAL_PACKAGE_ID);
			// upgradeCapabilityId and migrationStateId should be preserved
			expect(contractData?.upgradeCapabilityId).toBe(UPGRADE_CAP_ID);
			expect(contractData?.migrationStateId).toBe(MIGRATION_STATE_ID);
			// packageId and bytecode should be populated from the build
			expect(contractData?.packageId).toBeDefined();
			expect(contractData?.packageId).not.toBe("");
			expect(contractData?.packageBytecode).toBeDefined();
			expect(contractData?.packageBytecode).not.toBe("");
		}, 180000);
	});

	describe("Second build after successful upgrade", () => {
		it("should update lastDeployedPackageId to latest deployedPackageId on bytecode change", async () => {
			// Simulate state after a successful V1→V2 upgrade:
			// - deployedPackageId = new upgraded package (0xBBBB...)
			// - lastDeployedPackageId = original package (0xAAAA...) from previous build
			const postUpgradeState: ISmartContractDeployments = {
				[TEST_NETWORK]: {
					packageId: "0x0000000000000000000000000000000000000000000000000000000000000000",
					packageBytecode: "",
					deployedPackageId: UPGRADED_PACKAGE_ID,
					lastDeployedPackageId: ORIGINAL_PACKAGE_ID,
					upgradeCapabilityId: UPGRADE_CAP_ID,
					migrationStateId: MIGRATION_STATE_ID
				}
			};
			await writeFile(TEST_UPGRADE_CHAIN_JSON, JSON.stringify(postUpgradeState, null, "\t"));

			// Build the contract - bytecode will differ, triggering upgrade chain logic
			await runBuild();

			const result = await loadJson(TEST_UPGRADE_CHAIN_JSON);
			const contractData = result[TEST_NETWORK as keyof ISmartContractDeployments];

			// lastDeployedPackageId must be updated to the LATEST deployed package (0xBBBB),
			// because IOTA UpgradeCap.package is updated to the latest on each upgrade,
			// and published-at must match it.
			expect(contractData?.lastDeployedPackageId).toBe(UPGRADED_PACKAGE_ID);

			// deployedPackageId should be cleared (signals upgrade needed)
			expect(contractData?.deployedPackageId).toBeUndefined();

			// upgradeCapabilityId and migrationStateId should be preserved
			expect(contractData?.upgradeCapabilityId).toBe(UPGRADE_CAP_ID);
			expect(contractData?.migrationStateId).toBe(MIGRATION_STATE_ID);

			// packageId and bytecode should be populated from the build
			expect(contractData?.packageId).toBeDefined();
			expect(contractData?.packageId).not.toBe("");
		}, 180000);
	});

	describe("Build with unchanged bytecode", () => {
		it("should preserve deployedPackageId when bytecode has not changed", async () => {
			// First, build to get the actual packageId from the contract
			const freshState: ISmartContractDeployments = {
				[TEST_NETWORK]: {
					packageId: "",
					packageBytecode: ""
				}
			};
			await writeFile(TEST_UPGRADE_CHAIN_JSON, JSON.stringify(freshState, null, "\t"));
			await runBuild();

			// Read the actual packageId produced by the build
			const firstBuild = await loadJson(TEST_UPGRADE_CHAIN_JSON);
			const firstData = firstBuild[TEST_NETWORK as keyof ISmartContractDeployments];
			const actualPackageId = firstData?.packageId;

			// Now set up state as if this packageId was deployed (no bytecode change)
			const deployedState: ISmartContractDeployments = {
				[TEST_NETWORK]: {
					packageId: actualPackageId ?? "",
					packageBytecode: firstData?.packageBytecode ?? "",
					deployedPackageId: ORIGINAL_PACKAGE_ID,
					upgradeCapabilityId: UPGRADE_CAP_ID,
					migrationStateId: MIGRATION_STATE_ID
				}
			};
			await writeFile(TEST_UPGRADE_CHAIN_JSON, JSON.stringify(deployedState, null, "\t"));

			// Build again with same source - no bytecode change
			await runBuild();

			const result = await loadJson(TEST_UPGRADE_CHAIN_JSON);
			const contractData = result[TEST_NETWORK as keyof ISmartContractDeployments];

			// deployedPackageId should be preserved (bytecode didn't change)
			expect(contractData?.deployedPackageId).toBe(ORIGINAL_PACKAGE_ID);
			// lastDeployedPackageId should remain unset
			expect(contractData?.lastDeployedPackageId).toBeUndefined();
		}, 300000);
	});
});

/**
 * Run the build CLI command against the V1 test contract.
 */
async function runBuild(): Promise<void> {
	const deploymentConfig = {
		network: TEST_NETWORK,
		nodeEndpoint: TEST_NODE_ENDPOINT,
		faucetEndpoint: TEST_FAUCET_ENDPOINT,
		deployerMnemonic: TEST_DEPLOYER_MNEMONIC,
		gasBudget: TEST_GAS_BUDGET,
		gasStationUrl: TEST_GAS_STATION_URL,
		gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
	};
	const tempConfigPath = await createTempEnvConfig(deploymentConfig);

	try {
		const contractPath = path.join(TEST_CONTRACT_PATH_V1, "testContract");
		await cleanBuildArtifactsInPath(contractPath);

		const contractSources = path.join(TEST_CONTRACT_PATH_V1, "testContract/sources/*.move");
		const buildCommand = [
			"node",
			"move-to-json",
			"build",
			contractSources,
			"--network",
			TEST_NETWORK,
			"--output",
			TEST_UPGRADE_CHAIN_JSON,
			"--load-env",
			tempConfigPath
		];

		const cli = new CLI();
		const exitCode = await cli.run(buildCommand, "./dist/locales", {
			overrideOutputWidth: 1000
		});
		if (exitCode !== 0) {
			throw new Error(`Build command failed with exit code ${exitCode}`);
		}
	} finally {
		const fs = await import("node:fs/promises");
		try {
			await fs.unlink(tempConfigPath);
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Load and parse a deployment JSON file.
 * @param jsonPath Path to the JSON file.
 * @returns The parsed deployment data.
 */
async function loadJson(jsonPath: string): Promise<ISmartContractDeployments> {
	const content = await readFile(jsonPath, "utf8");
	return JSON.parse(content) as ISmartContractDeployments;
}
