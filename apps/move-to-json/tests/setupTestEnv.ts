// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { IotaClientOptions } from "@iota/iota-sdk/client";
import { Guards } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import { Iota, type IIotaConfig } from "@twin.org/dlt-iota";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVaultConnector,
	initSchema,
	type VaultKey,
	type VaultSecret
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import dotenv from "dotenv";

const execAsync = promisify(exec);

console.debug("Setting up move-to-json test environment from .env and .env.dev files");

dotenv.config({
	path: [path.join(__dirname, ".env"), path.join(__dirname, ".env.dev")],
	quiet: true
});

// Validate required environment variables (allow fallbacks for CI environment)
// Guards validation only if variables are explicitly set
if (process.env.TEST_NODE_ENDPOINT) {
	Guards.stringValue("TestEnv", "TEST_NODE_ENDPOINT", process.env.TEST_NODE_ENDPOINT);
}
if (process.env.TEST_FAUCET_ENDPOINT) {
	Guards.stringValue("TestEnv", "TEST_FAUCET_ENDPOINT", process.env.TEST_FAUCET_ENDPOINT);
}
if (process.env.TEST_NETWORK) {
	Guards.stringValue("TestEnv", "TEST_NETWORK", process.env.TEST_NETWORK);
}
if (process.env.TEST_COIN_TYPE) {
	Guards.stringValue("TestEnv", "TEST_COIN_TYPE", process.env.TEST_COIN_TYPE);
}

// Test configuration constants
export const TEST_DEPLOYER_IDENTITY = "deployer-identity";
export const TEST_MNEMONIC_NAME = "test-mnemonic";
export const TEST_NETWORK = process.env.TEST_NETWORK ?? "testnet";
export const TEST_NODE_ENDPOINT = process.env.TEST_NODE_ENDPOINT ?? "https://api.testnet.iota.cafe";
export const TEST_FAUCET_ENDPOINT =
	process.env.TEST_FAUCET_ENDPOINT ?? "https://faucet.testnet.iota.cafe/gas";
export const TEST_DEPLOYER_MNEMONIC = process.env.TEST_DEPLOYER_MNEMONIC ?? Bip39.randomMnemonic();
export const TEST_GAS_BUDGET = Number.parseInt(process.env.TEST_GAS_BUDGET ?? "50000000", 10);
export const TEST_COIN_TYPE = Number.parseInt(process.env.TEST_COIN_TYPE ?? "4218", 10);
export const TEST_GAS_STATION_URL = process.env.TEST_GAS_STATION_URL;
export const TEST_GAS_STATION_AUTH_TOKEN = process.env.TEST_GAS_STATION_AUTH_TOKEN;

// Minimum balance required for tests (1 IOTA in nano units = 1,000,000,000 nano IOTA)
const MIN_BALANCE_REQUIRED = 1000000000n;

// Test paths
export const TEST_CONTRACT_PATH_V1 = path.join(__dirname, "contracts/v1");
export const TEST_CONTRACT_PATH_V2 = path.join(__dirname, "contracts/v2");
export const TEST_CONTRACT_PATH_V3 = path.join(__dirname, "contracts/v3");
export const TEST_DEPLOYMENT_JSON_V1 = path.join(
	TEST_CONTRACT_PATH_V1,
	"v1-smart-contract-deployments.json"
);
export const TEST_DEPLOYMENT_JSON_V2 = path.join(
	TEST_CONTRACT_PATH_V2,
	"v2-smart-contract-deployments.json"
);
export const TEST_DEPLOYMENT_JSON_V3 = path.join(
	TEST_CONTRACT_PATH_V3,
	"v3-smart-contract-deployments.json"
);

initSchema();

// Setup entity storage connectors
EntityStorageConnectorFactory.register(
	"vault-key",
	() =>
		new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-key" }
		})
);

const secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
	entitySchema: nameof<VaultSecret>(),
	config: { storageKey: "vault-secret" }
});
EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);

// Setup vault connector
export const TEST_VAULT_CONNECTOR = new EntityStorageVaultConnector();
VaultConnectorFactory.register("vault", () => TEST_VAULT_CONNECTOR);

// Store deployer mnemonic in vault
await TEST_VAULT_CONNECTOR.setSecret(
	`${TEST_DEPLOYER_IDENTITY}/${TEST_MNEMONIC_NAME}`,
	TEST_DEPLOYER_MNEMONIC
);

// Setup client options
export const TEST_CLIENT_OPTIONS: IotaClientOptions = {
	url: TEST_NODE_ENDPOINT
};

export const TEST_IOTA_CONFIG: IIotaConfig = {
	clientOptions: TEST_CLIENT_OPTIONS,
	network: TEST_NETWORK,
	vaultMnemonicId: TEST_MNEMONIC_NAME,
	coinType: TEST_COIN_TYPE
};

const deployerAddresses = await Iota.getAddresses(
	TEST_VAULT_CONNECTOR,
	TEST_IOTA_CONFIG,
	TEST_DEPLOYER_IDENTITY,
	0,
	0,
	1
);
export const DEPLOYER_ADDRESS = deployerAddresses[0];

/**
 * Verify that IOTA CLI is installed and available.
 * @throws Error if IOTA CLI is not installed or version check fails.
 */
async function verifyIotaCliInstalled(): Promise<void> {
	try {
		console.debug("[setupTestEnv] Verifying IOTA CLI installation");
		await execAsync("iota --version");
	} catch (error) {
		if (
			(error as { code?: number }).code === 127 ||
			(error as Error).message.includes("not found")
		) {
			throw new Error(
				"IOTA CLI is not installed. Please install it from: https://github.com/iotaledger/iota/releases/",
				{ cause: error }
			);
		}
		throw new Error("Failed to check IOTA CLI version", { cause: error });
	}
}

/**
 * Set up test environment by ensuring deployer address has sufficient funds.
 * @returns Promise that resolves when setup is complete.
 */
export async function setupTestEnv(): Promise<void> {
	try {
		// Verify IOTA CLI is available
		await verifyIotaCliInstalled();

		console.debug("[setupTestEnv] Starting test environment setup");
		console.debug(`[setupTestEnv] Deployer address: ${DEPLOYER_ADDRESS}`);

		// Ensure deployer address has sufficient funds
		console.debug("[setupTestEnv] Ensuring deployer address has sufficient funds");
		await ensureFundsForAddress(TEST_DEPLOYER_IDENTITY, DEPLOYER_ADDRESS);

		console.debug("[setupTestEnv] Test environment setup completed");
	} catch (error) {
		console.error("[setupTestEnv] Setup failed:", error);
		throw error;
	}
}

/**
 * Ensure an address has sufficient funds for testing.
 * Only requests from faucet if current balance is below minimum required.
 * @param identity The identity to use for wallet operations.
 * @param address The address to ensure funds for.
 * @returns Promise that resolves when funds are ensured.
 */
async function ensureFundsForAddress(identity: string, address: string): Promise<void> {
	try {
		// Use ensureBalance which will automatically request from faucet if needed
		const success = await Iota.ensureBalance(
			TEST_IOTA_CONFIG,
			TEST_FAUCET_ENDPOINT,
			identity,
			address,
			MIN_BALANCE_REQUIRED,
			30
		);

		const currentBalance = await Iota.getBalance(TEST_IOTA_CONFIG, address);
		console.debug(`[ensureFundsForAddress] Address ${address} has balance: ${currentBalance}`);

		if (!success) {
			throw new Error(
				`Failed to ensure funds from faucet for address ${address}, requiredBalance: ${MIN_BALANCE_REQUIRED}, currentBalance: ${currentBalance}`
			);
		}
	} catch (error) {
		console.error(error);
		throw error;
	}
}

/**
 * Clean up test environment.
 * @returns Promise that resolves when cleanup is complete.
 */
export async function cleanupTestEnv(): Promise<void> {
	console.debug("[cleanupTestEnv] Cleaning up test environment");
	// No specific cleanup needed for move-to-json tests
}

/**
 * Create a temporary environment configuration file for move-to-json commands.
 * @param config The deployment configuration.
 * @param config.network The network to deploy to.
 * @param config.nodeEndpoint The node endpoint to deploy to.
 * @param config.faucetEndpoint The faucet endpoint to deploy to.
 * @param config.deployerMnemonic The deployer mnemonic to deploy to.
 * @param config.gasBudget The gas budget to deploy to.
 * @param config.gasStationUrl The gas station url to deploy to.
 * @param config.gasStationAuthToken The gas station auth token to deploy to.
 * @returns Promise that resolves to the temporary config file path.
 */
export async function createTempEnvConfig(config: {
	network: string;
	nodeEndpoint: string;
	faucetEndpoint: string;
	deployerMnemonic: string;
	gasBudget: number;
	gasStationUrl?: string;
	gasStationAuthToken?: string;
}): Promise<string> {
	const fs = await import("node:fs/promises");
	const tempConfigPath = path.join(__dirname, ".tmp", `test-env-${Date.now()}.env`);

	// Ensure temp directory exists
	await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });

	const envContent = [
		`NETWORK=${config.network}`,
		`RPC_URL=${config.nodeEndpoint}`,
		`FAUCET_URL=${config.faucetEndpoint}`,
		`DEPLOYER_MNEMONIC=${config.deployerMnemonic}`,
		`GAS_BUDGET=${config.gasBudget}`,
		"ADDRESS_INDEX=0",
		"RPC_TIMEOUT=30000",
		"CONFIRMATION_TIMEOUT=30000",
		config.gasStationUrl ? `GAS_STATION_URL=${config.gasStationUrl}` : "",
		config.gasStationAuthToken ? `GAS_STATION_AUTH_TOKEN=${config.gasStationAuthToken}` : ""
	]
		.filter(Boolean)
		.join("\n");

	await fs.writeFile(tempConfigPath, envContent);
	return tempConfigPath;
}
