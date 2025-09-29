// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import fs from "node:fs/promises";
import path from "node:path";
import { GeneralError } from "@twin.org/core";
import type { IContractData, ISmartContractDeployments } from "@twin.org/dlt-iota";
import { CLI } from "../../src/cli.js";
import { cleanBuildArtifactsInPath } from "../../src/utils/buildArtifactUtils.js";
import {
	TEST_CONTRACT_PATH_V1,
	TEST_CONTRACT_PATH_V2,
	TEST_DEPLOYER_MNEMONIC,
	TEST_DEPLOYMENT_JSON_V1,
	TEST_DEPLOYMENT_JSON_V2,
	TEST_FAUCET_ENDPOINT,
	TEST_GAS_BUDGET,
	TEST_GAS_STATION_AUTH_TOKEN,
	TEST_GAS_STATION_URL,
	TEST_NETWORK,
	TEST_NODE_ENDPOINT,
	createTempEnvConfig
} from "../setupTestEnv";

/**
 * Build V1 contract using move-to-json build command.
 * @returns Promise that resolves when build is complete.
 */
export async function buildV1Contract(): Promise<void> {
	let tempConfigPath: string | undefined;
	try {
		console.debug("[buildV1Contract] Starting V1 contract build");

		// Create test-specific configuration
		const deploymentConfig = {
			network: TEST_NETWORK,
			nodeEndpoint: TEST_NODE_ENDPOINT,
			faucetEndpoint: TEST_FAUCET_ENDPOINT,
			deployerMnemonic: TEST_DEPLOYER_MNEMONIC,
			gasBudget: TEST_GAS_BUDGET,
			gasStationUrl: TEST_GAS_STATION_URL,
			gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
		};

		tempConfigPath = await createTempEnvConfig(deploymentConfig);

		// Clean up any existing build artifacts
		await cleanupV1BuildArtifacts();

		const contractSources = path.join(TEST_CONTRACT_PATH_V1, "test-contract/sources/*.move");

		const buildCommand = [
			"node",
			"move-to-json",
			"build",
			contractSources,
			"--network",
			TEST_NETWORK,
			"--output",
			TEST_DEPLOYMENT_JSON_V1,
			"--load-env",
			tempConfigPath
		];
		console.debug(`[buildV1Contract] Executing: ${buildCommand.join(" ")}`);

		// Add timeout of 120 seconds for the build command
		const timeoutPromise = new Promise<never>((resolve, reject) => {
			setTimeout(
				() =>
					reject(
						new GeneralError(
							"upgradeTestHelpers",
							"buildTimeoutReached",
							undefined,
							"V1 build command timed out after 120 seconds"
						)
					),
				120000
			);
		});

		const cli = new CLI();
		const buildPromise = cli.run(buildCommand, "./dist/locales", {
			overrideOutputWidth: 1000
		});
		await Promise.race([buildPromise, timeoutPromise]);

		console.debug("[buildV1Contract] V1 contract build completed successfully");

		// Cleanup temporary config file
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn("[buildV1Contract] Failed to clean up temporary config file");
			}
		}
	} catch (error) {
		// Cleanup temporary config file on error
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn("[buildV1Contract] Failed to clean up temporary config file after error");
			}
		}
		console.error("[buildV1Contract] Error:", error);
		throw new Error("Building V1 contract failed", { cause: error });
	}
}

/**
 * Deploy V1 contract using move-to-json deploy command.
 * @returns Promise that resolves to deployment result data.
 */
export async function deployV1Contract(): Promise<IContractData> {
	let tempConfigPath: string | undefined;
	try {
		console.debug("[deployV1Contract] Starting V1 contract deployment");

		// Create test-specific configuration
		const deploymentConfig = {
			network: TEST_NETWORK,
			nodeEndpoint: TEST_NODE_ENDPOINT,
			faucetEndpoint: TEST_FAUCET_ENDPOINT,
			deployerMnemonic: TEST_DEPLOYER_MNEMONIC,
			gasBudget: TEST_GAS_BUDGET,
			gasStationUrl: TEST_GAS_STATION_URL,
			gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
		};

		tempConfigPath = await createTempEnvConfig(deploymentConfig);

		const deployCommand = [
			"node",
			"move-to-json",
			"deploy",
			"--network",
			TEST_NETWORK,
			"--contracts",
			TEST_DEPLOYMENT_JSON_V1,
			"--load-env",
			tempConfigPath
		];

		console.debug(`[deployV1Contract] Executing: ${deployCommand.join(" ")}`);

		// Add timeout of 180 seconds for the deploy command
		const timeoutPromise = new Promise<never>((resolve, reject) => {
			setTimeout(
				() =>
					reject(
						new GeneralError(
							"upgradeTestHelpers",
							"deployTimeoutReached",
							undefined,
							"V1 deploy command timed out after 180 seconds"
						)
					),
				180000
			);
		});

		const cli = new CLI();
		const deployPromise = cli.run(deployCommand, "./dist/locales", {
			overrideOutputWidth: 1000
		});
		await Promise.race([deployPromise, timeoutPromise]);

		// Load and return populated deployment data
		const deploymentData = await loadDeploymentConfig(TEST_DEPLOYMENT_JSON_V1);
		const contractData = deploymentData[TEST_NETWORK as keyof ISmartContractDeployments];

		if (!contractData?.deployedPackageId || !contractData?.upgradeCapabilityId) {
			throw new Error(
				`V1 deployment completed but required data is missing, deployedPackageId: ${contractData?.deployedPackageId}, upgradeCapabilityId: ${contractData?.upgradeCapabilityId}, migrationStateId: ${contractData?.migrationStateId}`
			);
		}

		const result = {
			packageId: contractData.packageId,
			packageBytecode: contractData.packageBytecode,
			deployedPackageId: contractData.deployedPackageId,
			lastDeployedPackageId: contractData.lastDeployedPackageId,
			upgradeCapabilityId: contractData.upgradeCapabilityId,
			migrationStateId: contractData.migrationStateId
		};

		console.debug("[deployV1Contract] V1 contract deployment completed successfully");

		// Cleanup temporary config file
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn("[deployV1Contract] Failed to clean up temporary config file");
			}
		}

		return result;
	} catch (error) {
		// Cleanup temporary config file on error
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn("[deployV1Contract] Failed to clean up temporary config file after error");
			}
		}
		throw new Error("Deploying V1 contract failed", { cause: error });
	}
}

/**
 * Build V2 contract using move-to-json build command.
 * @param v1Deployment The V1 deployment data to copy upgrade capability from.
 * @returns Promise that resolves when build is complete.
 */
export async function buildV2Contract(v1Deployment: IContractData): Promise<void> {
	let tempConfigPath: string | undefined;
	try {
		console.debug("[buildV2Contract] Starting V2 contract build");

		// Create test-specific configuration
		const deploymentConfig = {
			network: TEST_NETWORK,
			nodeEndpoint: TEST_NODE_ENDPOINT,
			faucetEndpoint: TEST_FAUCET_ENDPOINT,
			deployerMnemonic: TEST_DEPLOYER_MNEMONIC,
			gasBudget: TEST_GAS_BUDGET,
			gasStationUrl: TEST_GAS_STATION_URL,
			gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
		};

		tempConfigPath = await createTempEnvConfig(deploymentConfig);

		// Prepare V2 deployment JSON with V1 upgrade capability data
		const v2Config: ISmartContractDeployments = {
			[TEST_NETWORK]: {
				packageId: "", // Will be populated by build
				packageBytecode: "", // Will be populated by build
				deployedPackageId: v1Deployment.deployedPackageId, // Current deployment (will be cleared by build)
				lastDeployedPackageId: v1Deployment.deployedPackageId, // Set to current deployment for upgrade chain tracking
				upgradeCapabilityId: v1Deployment.upgradeCapabilityId, // Preserve upgrade capability
				migrationStateId: v1Deployment.migrationStateId // Preserve migration state
			}
		};

		await fs.writeFile(TEST_DEPLOYMENT_JSON_V2, JSON.stringify(v2Config, null, "\t"));

		// Clean up any existing V2 build artifacts
		await cleanupV2BuildArtifacts();

		const contractSources = path.join(TEST_CONTRACT_PATH_V2, "test-contract/sources/*.move");
		const buildCommand = [
			"node",
			"move-to-json",
			"build",
			contractSources,
			"--network",
			TEST_NETWORK,
			"--output",
			TEST_DEPLOYMENT_JSON_V2,
			"--load-env",
			tempConfigPath
		];
		console.debug(`[buildV2Contract] Executing: ${buildCommand.join(" ")}`);

		// Add timeout of 120 seconds for the build command
		const timeoutPromise = new Promise<never>((resolve, reject) => {
			setTimeout(
				() =>
					reject(
						new GeneralError(
							"upgradeTestHelpers",
							"buildTimeoutReached",
							undefined,
							"V2 build command timed out after 120 seconds"
						)
					),
				120000
			);
		});

		const cli = new CLI();
		const buildPromise = cli.run(buildCommand, "./dist/locales", {
			overrideOutputWidth: 1000
		});
		await Promise.race([buildPromise, timeoutPromise]);

		console.debug("[buildV2Contract] V2 contract build completed successfully");

		// Cleanup temporary config file
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn("[buildV2Contract] Failed to clean up temporary config file");
			}
		}
	} catch (error) {
		// Cleanup temporary config file on error
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn("[buildV2Contract] Failed to clean up temporary config file after error");
			}
		}
		console.error("[buildV2Contract] Error:", error);
		throw new Error("Building V2 contract failed", { cause: error });
	}
}

/**
 * Upgrade V1 to V2 using move-to-json deploy command with smart upgrade detection.
 * @returns Promise that resolves to upgraded deployment data.
 */
export async function upgradeToV2UsingSmartDeploy(): Promise<IContractData> {
	let tempConfigPath: string | undefined;
	try {
		console.debug("[upgradeToV2UsingSmartDeploy] Starting smart deploy upgrade");

		// Create test-specific configuration
		const deploymentConfig = {
			network: TEST_NETWORK,
			nodeEndpoint: TEST_NODE_ENDPOINT,
			faucetEndpoint: TEST_FAUCET_ENDPOINT,
			deployerMnemonic: TEST_DEPLOYER_MNEMONIC,
			gasBudget: TEST_GAS_BUDGET,
			gasStationUrl: TEST_GAS_STATION_URL,
			gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
		};

		tempConfigPath = await createTempEnvConfig(deploymentConfig);

		const deployCommand = [
			"node",
			"move-to-json",
			"deploy",
			"--network",
			TEST_NETWORK,
			"--contracts",
			TEST_DEPLOYMENT_JSON_V2,
			"--load-env",
			tempConfigPath
		];

		console.debug(`[deployV2Contract] Executing: ${deployCommand.join(" ")}`);

		// Add timeout of 180 seconds for the deploy command
		const timeoutPromise = new Promise<never>((resolve, reject) => {
			setTimeout(
				() =>
					reject(
						new GeneralError(
							"upgradeTestHelpers",
							"upgradeTimeoutReached",
							undefined,
							"V2 upgrade command timed out after 180 seconds"
						)
					),
				180000
			);
		});

		const cli = new CLI();
		const deployPromise = cli.run(deployCommand, "./dist/locales", {
			overrideOutputWidth: 1000
		});
		await Promise.race([deployPromise, timeoutPromise]);

		// Load and return upgraded deployment data
		const deploymentData = await loadDeploymentConfig(TEST_DEPLOYMENT_JSON_V2);
		const contractData = deploymentData[TEST_NETWORK as keyof ISmartContractDeployments];

		if (!contractData?.deployedPackageId || !contractData?.upgradeCapabilityId) {
			throw new Error(
				`V2 upgrade completed but required data is missing, deployedPackageId: ${contractData?.deployedPackageId}, upgradeCapabilityId: ${contractData?.upgradeCapabilityId}, migrationStateId: ${contractData?.migrationStateId}`
			);
		}

		const result = {
			packageId: contractData.packageId,
			packageBytecode: contractData.packageBytecode,
			deployedPackageId: contractData.deployedPackageId,
			lastDeployedPackageId: contractData.lastDeployedPackageId,
			upgradeCapabilityId: contractData.upgradeCapabilityId,
			migrationStateId: contractData.migrationStateId
		};

		console.debug("[upgradeToV2UsingSmartDeploy] Smart deploy upgrade completed successfully");

		// Cleanup temporary config file
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn("[upgradeToV2UsingSmartDeploy] Failed to clean up temporary config file");
			}
		}

		return result;
	} catch (error) {
		// Cleanup temporary config file on error
		if (tempConfigPath) {
			try {
				await fs.unlink(tempConfigPath);
			} catch {
				console.warn(
					"[upgradeToV2UsingSmartDeploy] Failed to clean up temporary config file after error"
				);
			}
		}
		throw new Error("Smart deploy upgrade to V2 failed", { cause: error });
	}
}

/**
 * Load deployment configuration from JSON file.
 * @param jsonPath Path to the deployment JSON file.
 * @returns Promise that resolves to smart contract deployments configuration.
 */
export async function loadDeploymentConfig(jsonPath: string): Promise<ISmartContractDeployments> {
	try {
		const content = await fs.readFile(jsonPath, "utf8");
		return JSON.parse(content) as ISmartContractDeployments;
	} catch (error) {
		throw new Error(`Loading deployment configuration failed from ${jsonPath}`, { cause: error });
	}
}

/**
 * Clean up test artifacts including deployment JSONs and build directories.
 * @returns Promise that resolves when cleanup is complete.
 */
export async function cleanupTestArtifacts(): Promise<void> {
	try {
		console.debug("[cleanupTestArtifacts] Starting test artifacts cleanup");

		// Clean V1 deployment JSON
		const cleanV1Config: ISmartContractDeployments = {
			[TEST_NETWORK]: {
				packageId: "",
				packageBytecode: "",
				deployedPackageId: "",
				upgradeCapabilityId: "",
				migrationStateId: ""
			}
		};
		await fs.writeFile(TEST_DEPLOYMENT_JSON_V1, JSON.stringify(cleanV1Config, null, "\t"));

		// Clean V2 deployment JSON
		const cleanV2Config: ISmartContractDeployments = {
			[TEST_NETWORK]: {
				packageId: "",
				packageBytecode: "",
				deployedPackageId: "",
				upgradeCapabilityId: "",
				migrationStateId: ""
			}
		};
		await fs.writeFile(TEST_DEPLOYMENT_JSON_V2, JSON.stringify(cleanV2Config, null, "\t"));

		// Clean build artifacts
		await cleanupV1BuildArtifacts();
		await cleanupV2BuildArtifacts();

		// Clean temporary files
		const tempDir = path.join(__dirname, "..", ".tmp");
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {
			// Temp directory doesn't exist, which is fine
		}

		console.debug("[cleanupTestArtifacts] Test artifacts cleanup completed");
	} catch (error) {
		throw new Error("Cleaning test artifacts failed", { cause: error });
	}
}

/**
 * Clean V1 build artifacts (Move.lock and build directory).
 * @returns Promise that resolves when cleanup is complete.
 */
async function cleanupV1BuildArtifacts(): Promise<void> {
	const contractPath = path.join(TEST_CONTRACT_PATH_V1, "test-contract");
	await cleanBuildArtifactsInPath(contractPath);
}

/**
 * Clean V2 build artifacts (Move.lock and build directory).
 * @returns Promise that resolves when cleanup is complete.
 */
async function cleanupV2BuildArtifacts(): Promise<void> {
	const contractPath = path.join(TEST_CONTRACT_PATH_V2, "test-contract");
	await cleanBuildArtifactsInPath(contractPath);
}
