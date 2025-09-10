// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { exec, spawn } from "node:child_process";
import { CLIDisplay } from "@twin.org/cli-core";
import { GeneralError, I18n, Is } from "@twin.org/core";

/**
 * Executes a command with a timeout.
 * @param command The command to execute.
 * @param timeoutMs The timeout in milliseconds.
 * @returns The stdout and stderr of the command
 */
export async function execAsyncWithTimeout(
	command: string,
	timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(
				new GeneralError("environmentUtils", "error.environmentUtils.commandTimeout", {
					command,
					timeout: timeoutMs
				})
			);
		}, timeoutMs);

		exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
			clearTimeout(timeoutId);
			if (error) {
				reject(error);
			} else {
				resolve({ stdout, stderr });
			}
		});
	});
}

/**
 * Execute a command with input.
 * @param command The command to execute.
 * @param inputs The inputs to provide to the command.
 * @returns A promise that resolves when the command completes.
 */
export async function execWithInput(command: string, inputs: string[]): Promise<void> {
	const child = spawn(command, { shell: true, stdio: ["pipe", "inherit", "inherit"] });

	for (const input of inputs) {
		await new Promise(resolve => setTimeout(resolve, 500));
		child.stdin.write(`${input}\n`);
	}

	child.stdin.end();

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			child.kill("SIGTERM");
			reject(
				new GeneralError("environmentUtils", "error.environmentUtils.commandTimeout", {
					command,
					inputs,
					timeout: 5000
				})
			);
		}, 5000);

		child.on("close", code => {
			clearTimeout(timeout);

			if (code === 0) {
				resolve();
			} else {
				reject(
					new GeneralError("environmentUtils", "error.environmentUtils.commandFailedWithCode", {
						command,
						inputs,
						code
					})
				);
			}
		});

		child.on("error", error => {
			clearTimeout(timeout);
			reject(
				new GeneralError("environmentUtils", "error.environmentUtils.commandExecutionFailed", {
					command,
					inputs,
					error
				})
			);
		});
	});
}

/**
 * Verify that IOTA CLI is installed and available.
 * @throws GeneralError if IOTA CLI is not installed or version check fails.
 */
export async function verifyIotaCliInstalled(): Promise<void> {
	try {
		await execAsyncWithTimeout("iota --version", 5000);
	} catch (error) {
		if (
			(error as { code?: number }).code === 127 ||
			(error as NodeJS.ErrnoException).code === "ENOENT"
		) {
			throw new GeneralError(
				"environmentUtils",
				"error.environmentUtils.iotaCliNotFound",
				undefined,
				error
			);
		}
		throw new GeneralError(
			"environmentUtils",
			"error.environmentUtils.iotaCliVerificationFailed",
			undefined,
			error
		);
	}
}

/**
 * Check if a specific IOTA environment exists.
 * @param network The network alias to check for.
 * @returns Promise<boolean> True if environment exists, false otherwise.
 */
export async function checkEnvironmentExists(network: string): Promise<boolean> {
	try {
		const { stdout } = await execAsyncWithTimeout("iota client envs --json", 5000);
		const envData = JSON.parse(stdout);

		// The IOTA CLI returns [environments[], currentEnv] format
		const environments: [{ alias: string }] = Is.arrayValue(envData) ? envData[0] : envData;

		if (Is.arrayValue(environments)) {
			return environments.some(env => env.alias === network);
		}

		return false;
	} catch {
		// Silently return false if environment check fails - let calling code handle messaging
		return false;
	}
}

/**
 * Create a new IOTA environment.
 * @param network The network alias to create.
 * @param rpcUrl The RPC URL for the network.
 * @returns Promise<void>
 */
export async function createEnvironment(network: string, rpcUrl: string): Promise<void> {
	const isWindows = process.platform === "win32";

	try {
		const additionalInfo = isWindows ? "" : " || true";
		await execWithInput(`iota client new-env --alias ${network} --rpc ${rpcUrl}${additionalInfo}`, [
			"0"
		]);
		await execAsyncWithTimeout(`iota client switch --env ${network}${additionalInfo}`, 5000);
	} catch (error) {
		throw new GeneralError(
			"environmentUtils",
			"environmentCreationFailed",
			{ network, rpcUrl },
			error
		);
	}
}

/**
 * Create default IOTA environments when none exist.
 * @returns Promise<void>
 */
async function createDefaultEnvironments(): Promise<void> {
	const defaultEnvironments = [
		{ alias: "mainnet", rpc: "https://api.mainnet.iota.cafe" },
		{ alias: "devnet", rpc: "https://api.devnet.iota.cafe" },
		{ alias: "testnet", rpc: "https://api.testnet.iota.cafe" },
		{ alias: "localnet", rpc: "http://127.0.0.1:9000" }
	];

	CLIDisplay.value(
		I18n.formatMessage("info.environmentUtils.creatingDefaultEnvironments"),
		`${defaultEnvironments.length} environments`,
		1
	);

	for (const env of defaultEnvironments) {
		try {
			await createEnvironment(env.alias, env.rpc);
			CLIDisplay.value(
				I18n.formatMessage("info.environmentUtils.createdEnvironment"),
				env.alias,
				2
			);
		} catch {
			// Continue creating other environments even if one fails
		}
	}

	// Set testnet as active by default
	const isWindows = process.platform === "win32";
	const additionalInfo = isWindows ? "" : " || true";
	try {
		await execAsyncWithTimeout(`iota client switch --env testnet${additionalInfo}`, 5000);
		CLIDisplay.value(I18n.formatMessage("info.environmentUtils.activeEnvironment"), "testnet", 1);
	} catch {
		// Ignore switch failures - testnet might not exist yet
	}
}

/**
 * Check if any IOTA environments exist by attempting to list them.
 * If the command times out, it likely means no environments are configured.
 * @returns Promise<boolean> True if any environments exist, false otherwise.
 */
async function checkAnyEnvironmentsExist(): Promise<boolean> {
	try {
		const { stdout } = await execAsyncWithTimeout("iota client envs --json", 5000);
		const envData = JSON.parse(stdout);
		const environments: unknown[] = Is.arrayValue(envData) ? envData[0] : envData;
		return Is.arrayValue(environments);
	} catch {
		// Timeout or error likely means no environments exist
		return false;
	}
}

/**
 * Ensure that a specific IOTA environment exists, creating it if necessary.
 * If no environments exist at all, creates default environments first.
 * @param network The network alias to ensure exists.
 * @param rpcUrl The RPC URL for the network.
 * @returns Promise<void>
 */
export async function ensureEnvironment(network: string, rpcUrl: string): Promise<void> {
	// First verify IOTA CLI is installed
	await verifyIotaCliInstalled();

	// Check if any environments exist at all
	const anyEnvironmentsExist = await checkAnyEnvironmentsExist();

	if (!anyEnvironmentsExist) {
		// No environments exist - create defaults
		CLIDisplay.value(
			I18n.formatMessage("info.environmentUtils.noEnvironments"),
			I18n.formatMessage("info.environmentUtils.creatingDefaults"),
			1
		);
		await createDefaultEnvironments();
	}

	// Now check if the specific environment exists
	const exists = await checkEnvironmentExists(network);

	if (!exists) {
		// Use CLI framework for user-facing message
		CLIDisplay.value(I18n.formatMessage("info.environmentUtils.creatingEnvironment"), network, 1);
		await createEnvironment(network, rpcUrl);
	} else {
		// Switch to the environment to make sure it's active
		const isWindows = process.platform === "win32";
		const additionalInfo = isWindows ? "" : " || true";
		await execAsyncWithTimeout(`iota client switch --env ${network}${additionalInfo}`, 5000);
	}
}
