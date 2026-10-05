// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { I18n } from "@twin.org/core";
import {
	checkEnvironmentExists,
	createEnvironment,
	execAsyncWithTimeout,
	execWithInput,
	verifyIotaCliInstalled,
	ensureEnvironment,
	supportsGrpcEnvironment
} from "../src/utils/environmentUtils.js";

const GRPC_SUPPORTED = await supportsGrpcEnvironment();

I18n.addDictionary(
	"en",
	JSON.parse(await readFile(path.join(import.meta.dirname, "../locales/en.json"), "utf8"))
);

describe("environmentUtils", () => {
	describe("execAsyncWithTimeout", () => {
		it("should execute simple commands successfully", async () => {
			const result = await execAsyncWithTimeout("echo 'test'", 5000);
			expect(result.stdout.trim()).toContain("test");
		});

		it("should timeout after specified duration", async () => {
			const isWindows = process.platform === "win32";

			await expect(
				execAsyncWithTimeout(isWindows ? "powershell Start-Sleep -Seconds 10" : "sleep 10", 1000)
			).rejects.toThrow("commandTimeout");
		}, 2000);
	});

	describe("execWithInput", () => {
		it("should resolve when the command exits before the inputs are written", async () => {
			await expect(
				execWithInput('node -e "process.exit(0)"', ["0"], 3000)
			).resolves.toBeUndefined();
		}, 5000);

		it("should write the inputs to a command that prompts", async () => {
			await expect(
				execWithInput(
					"node -e \"process.stdin.once('data', d => process.exit(d.toString().trim() === '0' ? 0 : 1))\"",
					["0"],
					3000
				)
			).resolves.toBeUndefined();
		}, 5000);

		it("should reject when the command exits with a failure code", async () => {
			await expect(execWithInput('node -e "process.exit(2)"', ["0"], 3000)).rejects.toThrow(
				"commandFailedWithCode"
			);
		}, 5000);
	});

	describe("checkEnvironmentExists", () => {
		it("should parse environment data correctly", async () => {
			// Test with mock data that matches actual IOTA CLI output
			const mockOutput = `[
									[
										{
										"alias": "mainnet",
										"rpc": "https://api.mainnet.iota.cafe",
										"graphql": null,
										"ws": null,
										"basic_auth": null,
										"faucet": null
										},
										{
										"alias": "testnet", 
										"rpc": "https://api.testnet.iota.cafe",
										"graphql": null,
										"ws": null,
										"basic_auth": null,
										"faucet": null
										}
									],
									"testnet"
								]`;

			const envData = JSON.parse(mockOutput);
			const environments = Array.isArray(envData) && envData.length > 0 ? envData[0] : envData;

			expect(Array.isArray(environments)).toBe(true);
			expect(environments.some((env: { alias: string }) => env.alias === "testnet")).toBe(true);
			expect(environments.some((env: { alias: string }) => env.alias === "mainnet")).toBe(true);
			expect(environments.some((env: { alias: string }) => env.alias === "devnet")).toBe(false);
		});

		it("should return false when checking non-existent environment", async () => {
			const result = await checkEnvironmentExists("non-existent-network");
			expect(result).toBe(false);
		});
	});

	describe("verifyIotaCliInstalled", () => {
		it("should verify IOTA CLI is installed", async () => {
			// This should pass if IOTA CLI is available
			await expect(verifyIotaCliInstalled()).resolves.toBeUndefined();
		});

		it("should throw error if IOTA CLI is not available", async () => {
			await expect(
				execAsyncWithTimeout("non-existent-iota-command --version", 5000)
			).rejects.toThrow();
		});
	});

	describe("Default Environment Creation", () => {
		it("should create default environments when none exist", async () => {
			await ensureEnvironment("testnet", "https://api.testnet.iota.cafe");

			// Check if all default environments were created
			const testnetExists = await checkEnvironmentExists("testnet");
			const mainnetExists = await checkEnvironmentExists("mainnet");
			const devnetExists = await checkEnvironmentExists("devnet");
			const localnetExists = await checkEnvironmentExists("localnet");

			expect(testnetExists).toBe(true);
			expect(mainnetExists).toBe(true);
			expect(devnetExists).toBe(true);
			expect(localnetExists).toBe(true);
		}, 60000);

		describe("with an empty IOTA config", () => {
			let configDir: string;
			let originalConfigDir: string | undefined;

			beforeAll(async () => {
				originalConfigDir = process.env.IOTA_CONFIG_DIR;
				configDir = await mkdtemp(path.join(os.tmpdir(), "move-to-json-iota-"));
				process.env.IOTA_CONFIG_DIR = configDir;
			});

			afterAll(async () => {
				if (originalConfigDir === undefined) {
					delete process.env.IOTA_CONFIG_DIR;
				} else {
					process.env.IOTA_CONFIG_DIR = originalConfigDir;
				}
				await rm(configDir, { recursive: true, force: true });
			});

			it.skipIf(!GRPC_SUPPORTED)(
				"should configure the gRPC url on default environments",
				async () => {
					await ensureEnvironment("testnet", "https://api.testnet.iota.cafe");

					const { stdout } = await execAsyncWithTimeout("iota client envs --json", 5000);
					const environments: { alias: string; grpc?: string | null }[] = JSON.parse(stdout)[0];

					expect(environments.find(env => env.alias === "testnet")?.grpc).toBe(
						"https://grpc.testnet.iota.cafe:443"
					);
				},
				60000
			);
		});

		describe("with an existing environment missing the gRPC url", () => {
			let configDir: string;
			let originalConfigDir: string | undefined;

			beforeAll(async () => {
				originalConfigDir = process.env.IOTA_CONFIG_DIR;
				configDir = await mkdtemp(path.join(os.tmpdir(), "move-to-json-iota-"));
				process.env.IOTA_CONFIG_DIR = configDir;
			});

			afterAll(async () => {
				if (originalConfigDir === undefined) {
					delete process.env.IOTA_CONFIG_DIR;
				} else {
					process.env.IOTA_CONFIG_DIR = originalConfigDir;
				}
				await rm(configDir, { recursive: true, force: true });
			});

			it.skipIf(!GRPC_SUPPORTED)(
				"should add the gRPC url to the existing environment",
				async () => {
					await createEnvironment("testnet", "https://api.testnet.iota.cafe");

					const getTestnetGrpc = async (): Promise<string | null | undefined> => {
						const { stdout } = await execAsyncWithTimeout("iota client envs --json", 5000);
						const environments: { alias: string; grpc?: string | null }[] = JSON.parse(stdout)[0];
						return environments.find(env => env.alias === "testnet")?.grpc;
					};

					expect(await getTestnetGrpc()).toBeNull();

					await ensureEnvironment("testnet", "https://api.testnet.iota.cafe");

					expect(await getTestnetGrpc()).toBe("https://grpc.testnet.iota.cafe:443");
				},
				60000
			);
		});
	});
});
