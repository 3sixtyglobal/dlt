// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { exec, type ExecOptionsWithStringEncoding, spawn } from "node:child_process";
import { promisify } from "node:util";
import { CLIDisplay } from "@twin.org/cli-core";
import { GeneralError, I18n, Is } from "@twin.org/core";

const execAsync = promisify(exec);

/**
 * Executes a command with a timeout.
 * @param command The command to execute.
 * @param options The exec options.
 * @returns The stdout and stderr of the command
 */
export async function execAsyncWithError(
	command: string,
	options?: ExecOptionsWithStringEncoding
): Promise<{ stdout: string; stderr: string }> {
	try {
		const { stdout, stderr } = await execAsync(command, options);
		return { stdout: stdout.toString(), stderr: stderr.toString() };
	} catch (error) {
		let cmd;
		let output;
		if (
			Is.object<{ cmd: string; stdout: string; stderr: string }>(error) &&
			Is.stringValue(error.cmd)
		) {
			cmd = error.cmd;
			output = `${error.stdout}\n${error.stderr}`.trim();
		}
		throw new GeneralError("environmentUtils", "commandExecutionFailedParams", {
			command: cmd ?? "",
			output: output ?? ""
		});
	}
}

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
				new GeneralError("environmentUtils", "commandTimeout", {
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
 * @param timeoutMs The timeout in milliseconds.
 * @returns A promise that resolves when the command completes.
 */
export async function execWithInput(
	command: string,
	inputs: string[],
	timeoutMs: number = 5000
): Promise<void> {
	const child = spawn(command, { shell: true, stdio: ["pipe", "inherit", "inherit"] });

	return new Promise<void>((resolve, reject) => {
		let inputTimer: NodeJS.Timeout | undefined;

		const timeout = setTimeout(() => {
			clearTimeout(inputTimer);
			child.kill("SIGTERM");
			reject(
				new GeneralError("environmentUtils", "commandTimeout", {
					command,
					inputs,
					timeout: timeoutMs
				})
			);
		}, timeoutMs);

		// Writing to a command that has already exited raises EPIPE, the exit code decides the result
		child.stdin.on("error", error => {
			if ((error as NodeJS.ErrnoException).code !== "EPIPE") {
				child.kill("SIGTERM");
			}
		});

		// Inputs are written after the listeners are attached, as the command may exit without prompting
		let inputIndex = 0;
		const writeNextInput = (): void => {
			if (child.exitCode !== null || child.signalCode !== null) {
				return;
			}
			if (inputIndex < inputs.length) {
				child.stdin.write(`${inputs[inputIndex++]}\n`);
				inputTimer = setTimeout(writeNextInput, 500);
			} else {
				child.stdin.end();
			}
		};
		inputTimer = setTimeout(writeNextInput, 500);

		child.on("close", code => {
			clearTimeout(timeout);
			clearTimeout(inputTimer);

			if (code === 0) {
				resolve();
			} else {
				reject(
					new GeneralError("environmentUtils", "commandFailedWithCode", {
						command,
						inputs,
						code
					})
				);
			}
		});

		child.on("error", error => {
			clearTimeout(timeout);
			clearTimeout(inputTimer);
			reject(
				new GeneralError("environmentUtils", "commandExecutionFailed", {
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
			throw new GeneralError("environmentUtils", "iotaCliNotFound", undefined, error);
		}
		throw new GeneralError("environmentUtils", "iotaCliVerificationFailed", undefined, error);
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
 * Check if a specific IOTA environment has a gRPC url configured.
 * @param network The network alias to check.
 * @returns Promise<boolean> True if the environment has a gRPC url, false otherwise.
 */
async function checkEnvironmentHasGrpc(network: string): Promise<boolean> {
	try {
		const { stdout } = await execAsyncWithTimeout("iota client envs --json", 5000);
		const envData = JSON.parse(stdout);
		const environments: { alias: string; grpc?: string | null }[] = Is.arrayValue(envData)
			? envData[0]
			: envData;

		return (
			Is.arrayValue(environments) &&
			environments.some(env => env.alias === network && Is.stringValue(env.grpc))
		);
	} catch {
		// Treat an unreadable config as missing the gRPC url
		return false;
	}
}

/**
 * Default IOTA environments, matching those created by the IOTA CLI.
 */
const DEFAULT_ENVIRONMENTS: { alias: string; rpc: string; grpc: string }[] = [
	{
		alias: "mainnet",
		rpc: "https://api.mainnet.iota.cafe",
		grpc: "https://grpc.mainnet.iota.cafe:443"
	},
	{
		alias: "devnet",
		rpc: "https://api.devnet.iota.cafe",
		grpc: "https://grpc.devnet.iota.cafe:443"
	},
	{
		alias: "testnet",
		rpc: "https://api.testnet.iota.cafe",
		grpc: "https://grpc.testnet.iota.cafe:443"
	},
	{ alias: "localnet", rpc: "http://127.0.0.1:9000", grpc: "http://127.0.0.1:50051" }
];

/**
 * Check if the installed IOTA CLI supports configuring a gRPC URL for an environment.
 * @returns Promise<boolean> True if the --grpc option is supported.
 */
export async function supportsGrpcEnvironment(): Promise<boolean> {
	try {
		const { stdout } = await execAsyncWithTimeout("iota client new-env --help", 5000);
		return stdout.includes("--grpc");
	} catch {
		// Older or unavailable CLI, so do not pass the gRPC option
		return false;
	}
}

/**
 * Create a new IOTA environment.
 * @param network The network alias to create.
 * @param rpcUrl The RPC URL for the network.
 * @param grpcUrl The gRPC URL for the network, only used if supported by the IOTA CLI.
 * @returns Promise<void>
 */
export async function createEnvironment(
	network: string,
	rpcUrl: string,
	grpcUrl?: string
): Promise<void> {
	const isWindows = process.platform === "win32";

	try {
		const additionalInfo = isWindows ? "" : " || true";
		const grpcOption =
			Is.stringValue(grpcUrl) && (await supportsGrpcEnvironment()) ? ` --grpc ${grpcUrl}` : "";
		await execWithInput(
			`iota client new-env --alias ${network} --rpc ${rpcUrl}${grpcOption}${additionalInfo}`,
			["0"],
			30000
		);
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
	CLIDisplay.value(
		I18n.formatMessage("commands.common.info.creatingDefaultEnvironments"),
		`${DEFAULT_ENVIRONMENTS.length} environments`,
		1
	);

	for (const env of DEFAULT_ENVIRONMENTS) {
		try {
			await createEnvironment(env.alias, env.rpc, env.grpc);
			CLIDisplay.value(I18n.formatMessage("commands.common.info.createdEnvironment"), env.alias, 2);
		} catch {
			// Continue creating other environments even if one fails
		}
	}

	// Set testnet as active by default
	const isWindows = process.platform === "win32";
	const additionalInfo = isWindows ? "" : " || true";
	try {
		await execAsyncWithTimeout(`iota client switch --env testnet${additionalInfo}`, 5000);
		CLIDisplay.value(I18n.formatMessage("commands.common.info.activeEnvironment"), "testnet", 1);
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
			I18n.formatMessage("commands.common.info.noEnvironments"),
			I18n.formatMessage("commands.common.info.creatingDefaults"),
			1
		);
		await createDefaultEnvironments();
	}

	// Now check if the specific environment exists
	const exists = await checkEnvironmentExists(network);
	const defaultEnvironment = DEFAULT_ENVIRONMENTS.find(
		env => env.alias === network && env.rpc === rpcUrl
	);

	if (!exists) {
		// Use CLI framework for user-facing message
		CLIDisplay.value(I18n.formatMessage("commands.common.info.creatingEnvironment"), network, 1);
		await createEnvironment(network, rpcUrl, defaultEnvironment?.grpc);
	} else if (
		Is.object(defaultEnvironment) &&
		!(await checkEnvironmentHasGrpc(network)) &&
		(await supportsGrpcEnvironment())
	) {
		// Environments created by older CLIs have no gRPC url, re-adding the alias updates it in place
		CLIDisplay.value(
			I18n.formatMessage("commands.common.info.updatingEnvironmentGrpc"),
			network,
			1
		);
		await createEnvironment(network, rpcUrl, defaultEnvironment.grpc);
	} else {
		// Switch to the environment to make sure it's active
		const isWindows = process.platform === "win32";
		const additionalInfo = isWindows ? "" : " || true";
		await execAsyncWithTimeout(`iota client switch --env ${network}${additionalInfo}`, 5000);
	}
}
