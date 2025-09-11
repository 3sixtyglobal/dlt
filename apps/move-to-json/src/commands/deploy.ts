// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { IotaClient } from "@iota/iota-sdk/client";
import { requestIotaFromFaucetV0 } from "@iota/iota-sdk/faucet";
import { CLIDisplay, CLIUtils, CLIParam } from "@twin.org/cli-core";
import { GeneralError, Is, Converter, I18n, Guards, RandomHelper } from "@twin.org/core";
import { Bip39, Bip44 } from "@twin.org/crypto";
import {
	Iota,
	type IContractData,
	type ISmartContractDeployments,
	NetworkTypes
} from "@twin.org/dlt-iota";
import { nameof } from "@twin.org/nameof";
import type { Command } from "commander";
import type { INetworkConfig } from "../models/INetworkConfig";
import { ensureEnvironment } from "../utils/environmentUtils.js";
import {
	validateDeploymentEnvironment,
	getDeploymentMnemonic,
	getDeploymentSeed
} from "../utils/envSetup.js";
import { verifyIotaSDK } from "../utils/iotaUtils.js";
import { searchDirectoryForMoveToml } from "../utils/moveToJsonUtils.js";

const execAsync = promisify(exec);

/**
 * Build the deploy command.
 * @param program The command program.
 */
export function buildCommandDeploy(program: Command): void {
	program
		.command("deploy")
		.description(I18n.formatMessage("commands.deploy.description"))
		.option(
			I18n.formatMessage("commands.deploy.options.contracts.param"),
			I18n.formatMessage("commands.deploy.options.contracts.description"),
			"smart-contract-deployments.json"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.network.param"),
			I18n.formatMessage("commands.deploy.options.network.description"),
			"!NETWORK"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.dryRun.param"),
			I18n.formatMessage("commands.deploy.options.dryRun.description")
		)
		.option(
			I18n.formatMessage("commands.deploy.options.force.param"),
			I18n.formatMessage("commands.deploy.options.force.description")
		)
		.option(
			I18n.formatMessage("commands.deploy.options.rpcUrl.param"),
			I18n.formatMessage("commands.deploy.options.rpcUrl.description"),
			"!RPC_URL"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.addressIndex.param"),
			I18n.formatMessage("commands.deploy.options.addressIndex.description"),
			"!ADDRESS_INDEX"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.rpcTimeout.param"),
			I18n.formatMessage("commands.deploy.options.rpcTimeout.description"),
			"!RPC_TIMEOUT"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.gasBudget.param"),
			I18n.formatMessage("commands.deploy.options.gasBudget.description"),
			"!GAS_BUDGET"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.confirmationTimeout.param"),
			I18n.formatMessage("commands.deploy.options.confirmationTimeout.description"),
			"!CONFIRMATION_TIMEOUT"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.faucetUrl.param"),
			I18n.formatMessage("commands.deploy.options.faucetUrl.description"),
			"!FAUCET_URL"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.deployerMnemonic.param"),
			I18n.formatMessage("commands.deploy.options.deployerMnemonic.description"),
			"!DEPLOYER_MNEMONIC"
		)
		.option(
			I18n.formatMessage("commands.deploy.options.deployerSeed.param"),
			I18n.formatMessage("commands.deploy.options.deployerSeed.description"),
			"!DEPLOYER_SEED"
		)
		.action(actionCommandDeploy);
}

/**
 * Action for the deploy command.
 * @param opts Command options.
 * @param opts.contracts Path to compiled modules JSON.
 * @param opts.network Network identifier - optional if NETWORK env var is set.
 * @param opts.dryRun Simulate deployment without executing.
 * @param opts.force Force redeployment of existing packages.
 * @param opts.rpcUrl RPC endpoint URL for the network.
 * @param opts.addressIndex Address index for key derivation.
 * @param opts.rpcTimeout RPC request timeout in milliseconds.
 * @param opts.gasBudget Gas budget for transactions.
 * @param opts.confirmationTimeout Transaction confirmation timeout in milliseconds.
 * @param opts.faucetUrl Faucet URL for requesting test tokens.
 * @param opts.deployerMnemonic Deployer wallet mnemonic phrase.
 * @param opts.deployerSeed Deployer wallet seed (alternative to mnemonic).
 */
export async function actionCommandDeploy(opts: {
	contracts?: string;
	network?: NetworkTypes;
	dryRun?: boolean;
	force?: boolean;
	rpcUrl?: string;
	addressIndex?: string;
	rpcTimeout?: string;
	gasBudget?: string;
	confirmationTimeout?: string;
	faucetUrl?: string;
	deployerMnemonic?: string;
	deployerSeed?: string;
}): Promise<void> {
	const contractsPath = opts.contracts ?? "smart-contract-deployments.json";
	const dryRun = opts.dryRun ?? false;
	const force = opts.force ?? false;

	CLIDisplay.section(I18n.formatMessage("commands.deploy.section.deployContracts"));
	CLIDisplay.section(contractsPath);

	const networkRaw = CLIParam.stringValue("network", opts.network);
	const network = networkRaw as NetworkTypes;

	Guards.arrayOneOf("commands", nameof(network), network, Object.values(NetworkTypes));

	// Verify the IOTA SDK before we do anything else
	await verifyIotaSDK();

	// Get configuration values needed for environment setup
	const rpcUrl: string = CLIParam.stringValue("rpcUrl", opts.rpcUrl);
	const addressIndex = CLIParam.number("addressIndex", opts.addressIndex) ?? 0;
	const rpcTimeout = CLIParam.number("rpcTimeout", opts.rpcTimeout);
	const gasBudget = CLIParam.number("gasBudget", opts.gasBudget);
	const confirmationTimeout = CLIParam.number("confirmationTimeout", opts.confirmationTimeout);
	const faucetUrl: string | undefined =
		network === NetworkTypes.Mainnet
			? undefined
			: CLIParam.stringValue("faucetUrl", opts.faucetUrl);

	let deployerMnemonic: string | undefined;
	try {
		deployerMnemonic = CLIParam.stringValue("deployerMnemonic", opts.deployerMnemonic);
	} catch {
		// Optional parameter, can be undefined
		deployerMnemonic = undefined;
	}

	let deployerSeed: string | undefined;
	try {
		deployerSeed = CLIParam.stringValue("deployerSeed", opts.deployerSeed);
	} catch {
		// Optional parameter, can be undefined
		deployerSeed = undefined;
	}

	// Validate that at least one deployer credential is provided
	const hasValidMnemonic = Is.stringValue(deployerMnemonic);
	const hasValidSeed = Is.stringValue(deployerSeed);

	if (!hasValidMnemonic && !hasValidSeed) {
		throw new GeneralError("commands", "commands.deploy.deployerCredentialRequired", {
			network
		});
	}

	// Check/switch to target network environment BEFORE loading config
	await setIotaEnvironment(network, rpcUrl, addressIndex, dryRun, deployerMnemonic, deployerSeed);

	const config = await createNetworkConfig(
		network,
		rpcUrl,
		addressIndex,
		rpcTimeout,
		gasBudget,
		confirmationTimeout
	);
	validateNetworkConfig(config, network);

	const contractsData = await loadCompiledContracts(contractsPath);

	if (network === NetworkTypes.Mainnet) {
		const validatedMnemonic = await getDeploymentMnemonic(
			network,
			hasValidMnemonic ? deployerMnemonic : undefined
		);
		await validateDeploymentEnvironment(network, validatedMnemonic);
	}

	const networkContracts = contractsData[network];
	if (!Is.object<IContractData>(networkContracts)) {
		throw new GeneralError("commands", "commands.deploy.noContractsFound", {
			network,
			contractsPath
		});
	}

	await deployContract(
		"contract",
		networkContracts,
		config,
		network,
		dryRun,
		force,
		faucetUrl,
		deployerMnemonic,
		deployerSeed
	);

	if (!dryRun) {
		await updateContractsFile(contractsPath, contractsData);
	}

	CLIDisplay.done();
}

/**
 * Switch IOTA CLI to the target network environment and set the active address.
 * @param network Target network to switch to
 * @param rpcUrl The RPC URL for the network
 * @param addressIndex The address index to derive the target address
 * @param dryRun Whether this is a dry run (checks environment but doesn't switch)
 * @param deployerMnemonic The deployer mnemonic from environment variables.
 * @param deployerSeed The deployer seed from environment variables (optional).
 */
async function setIotaEnvironment(
	network: NetworkTypes,
	rpcUrl: string,
	addressIndex: number,
	dryRun: boolean = false,
	deployerMnemonic?: string,
	deployerSeed?: string
): Promise<void> {
	try {
		CLIDisplay.task(
			dryRun
				? I18n.formatMessage("commands.deploy.progress.checkingEnvironment")
				: I18n.formatMessage("commands.deploy.progress.settingEnvironment")
		);

		// Ensure environment exists, create if necessary
		Guards.stringValue("setIotaEnvironment", nameof(rpcUrl), rpcUrl);

		await ensureEnvironment(network, rpcUrl);

		if (dryRun) {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.iotaEnvironmentCheck"),
				`✅ ${network} environment exists`,
				1
			);
			return;
		}

		// Derive the target address from existing mnemonic/seed
		const targetAddress = await getDeploymentWalletAddress(
			network,
			addressIndex,
			deployerMnemonic,
			deployerSeed
		);

		// Ensure the correct deployer key exists in the keystore
		const aliasName = `deployer-${network}`;
		const validatedMnemonic = await getDeploymentMnemonic(network, deployerMnemonic);
		await ensureCorrectDeployerKey(
			network,
			aliasName,
			targetAddress,
			addressIndex,
			validatedMnemonic
		);

		// Switch both environment and address in one command
		await execAsync(`iota client switch --env ${network} --address ${targetAddress}`);

		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.switchedIotaEnvironment"),
			network,
			1
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.switchedActiveAddress"),
			targetAddress,
			1
		);

		// Verify the switch was successful
		const { stdout: activeEnv } = await execAsync("iota client active-env");
		if (!activeEnv.includes(network)) {
			throw new GeneralError("commands", "commands.deploy.environmentSwitchFailed", {
				network,
				activeEnv
			});
		}

		// Verify address switch was successful
		const { stdout: activeAddressOutput } = await execAsync("iota client active-address");
		const activeAddress = activeAddressOutput.trim();
		if (activeAddress !== targetAddress) {
			throw new GeneralError("commands", "commands.deploy.addressSwitchFailed", {
				network,
				targetAddress,
				activeAddress
			});
		}
	} catch (error) {
		throw new GeneralError(
			"commands",
			"commands.deploy.environmentOperationFailed",
			{ network, operation: dryRun ? "check" : "switch to" },
			error
		);
	}
}

/**
 * Creates the network configuration.
 * @param network Target network to determine which env file to load.
 * @param rpcUrl The RPC URL for the network.
 * @param addressIndex The address index for the wallet.
 * @param rpcTimeout The RPC timeout in milliseconds.
 * @param gasBudget The gas budget for deployment.
 * @param confirmationTimeout The confirmation timeout in seconds.
 * @returns Network configuration.
 */
async function createNetworkConfig(
	network: NetworkTypes,
	rpcUrl: string,
	addressIndex: number,
	rpcTimeout?: number,
	gasBudget?: number,
	confirmationTimeout?: number
): Promise<INetworkConfig> {
	try {
		Guards.stringValue("createNetworkConfig", nameof(rpcUrl), rpcUrl);

		const config: INetworkConfig = {
			network,
			platform: "iota",
			rpc: {
				url: rpcUrl,
				timeout: rpcTimeout ?? 60000
			},
			deployment: {
				gasBudget: gasBudget ?? 50000000,
				confirmationTimeout: confirmationTimeout ?? 60,
				wallet: {
					addressIndex
				}
			}
		};

		return config;
	} catch (err) {
		throw new GeneralError("commands", "commands.deploy.networkConfigInvalid", { network }, err);
	}
}

/**
 * Validate network configuration matches expected network.
 * @param config Network configuration.
 * @param expectedNetwork Expected network type.
 * @throws GeneralError if the network configuration is invalid.
 */
function validateNetworkConfig(config: INetworkConfig, expectedNetwork: NetworkTypes): void {
	if (config.network !== expectedNetwork) {
		throw new GeneralError("commands", "commands.deploy.networkMismatch", {
			expected: expectedNetwork,
			actual: config.network,
			help: `Configuration file specifies '${config.network}' but command targets '${expectedNetwork}'`
		});
	}

	if (!Is.stringValue(config.rpc?.url)) {
		throw new GeneralError("commands", "commands.deploy.rpcUrlRequired", {
			network: expectedNetwork
		});
	}

	if (!Is.number(config.deployment?.gasBudget)) {
		throw new GeneralError("commands", "commands.deploy.gasBudgetRequired", {
			network: expectedNetwork
		});
	}
}

/**
 * Load compiled contracts from file.
 * @param contractsPath Path to contracts file.
 * @returns Compiled contracts data.
 */
async function loadCompiledContracts(contractsPath: string): Promise<ISmartContractDeployments> {
	try {
		if (!(await CLIUtils.fileExists(contractsPath))) {
			throw new GeneralError("commands", "commands.deploy.contractsFileNotFound", {
				contractsPath
			});
		}

		const contracts = await CLIUtils.readJsonFile<ISmartContractDeployments>(contractsPath);

		if (!Is.object(contracts)) {
			throw new GeneralError("commands", "commands.deploy.invalidContractsFile");
		}

		return contracts;
	} catch (err) {
		throw new GeneralError(
			"commands",
			"commands.deploy.contractsLoadFailed",
			{ contractsPath },
			err
		);
	}
}

/**
 * Validate environment and setup for deployment based on network type.
 * @param network Target network.
 * @param config Network configuration.
 * @param isDryRun Whether this is a dry run.
 * @param faucetUrl The faucet URL (optional, defaults to network-specific URL).
 * @param deployerMnemonic The deployer mnemonic for validation.
 * @param deployerSeed The deployer seed (optional).
 * @returns Wallet address for the deployment.
 */
async function validateEnvironmentForNetwork(
	network: NetworkTypes,
	config: INetworkConfig,
	isDryRun: boolean = false,
	faucetUrl?: string,
	deployerMnemonic?: string,
	deployerSeed?: string
): Promise<string> {
	const walletAddress = await getDeploymentWalletAddress(
		network,
		config.deployment.wallet.addressIndex,
		deployerMnemonic,
		deployerSeed
	);

	if (isDryRun) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.dryRunWalletAddress"),
			walletAddress,
			1
		);
	} else {
		CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.walletAddress"), walletAddress, 1);
	}

	if (network === NetworkTypes.Mainnet) {
		const validatedMnemonic = await getDeploymentMnemonic(network, deployerMnemonic);
		await validateDeploymentEnvironment(network, validatedMnemonic);
	} else if ((network === NetworkTypes.Testnet || network === NetworkTypes.Devnet) && !isDryRun) {
		// For testnet/devnet, check balance first and only request funds if needed
		await checkBalanceAndRequestFaucetIfNeeded(network, config, walletAddress, faucetUrl);
	}

	return walletAddress;
}

/**
 * Check wallet balance and display relevant information.
 * @param network Target network.
 * @param config Network configuration.
 * @param walletAddress Wallet address.
 * @param isDryRun Whether this is a dry run.
 * @returns Balance in nanos.
 */
async function checkWalletBalance(
	network: NetworkTypes,
	config: INetworkConfig,
	walletAddress: string,
	isDryRun: boolean = false
): Promise<number> {
	const client = new IotaClient({ url: config.rpc.url });
	const balanceResponse = await client.getBalance({ owner: walletAddress });
	const balanceInNanos = Number(balanceResponse.totalBalance);
	const requiredInNanos = config.deployment.gasBudget;

	const balanceInIota = nanosToIota(balanceInNanos);
	const requiredInIota = nanosToIota(requiredInNanos);

	const balanceLabel = isDryRun
		? "commands.deploy.labels.dryRunWalletBalance"
		: "commands.deploy.labels.walletBalance";
	const gasBudgetLabel = isDryRun
		? "commands.deploy.labels.dryRunGasBudget"
		: "commands.deploy.labels.gasBudget";

	CLIDisplay.value(I18n.formatMessage(balanceLabel), `${balanceInIota.toFixed(2)} IOTA`, 1);
	CLIDisplay.value(I18n.formatMessage(gasBudgetLabel), `${requiredInIota.toFixed(2)} IOTA`, 1);

	// Handle insufficient balance based on network and run type (compare in same units - nanos)
	if (balanceInNanos < requiredInNanos) {
		if (isDryRun) {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.warning"),
				I18n.formatMessage("commands.deploy.labels.insufficientBalanceWarning", {
					currentBalance: balanceInIota.toFixed(2),
					requiredBalance: requiredInIota.toFixed(2)
				}),
				2
			);
		} else if (network === NetworkTypes.Mainnet) {
			throw new GeneralError("commands", "commands.deploy.insufficientBalance", {
				balance: balanceInIota,
				required: requiredInIota,
				walletAddress
			});
		} else {
			// For testnet/devnet, show warning but continue
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.warning"),
				I18n.formatMessage("commands.deploy.labels.insufficientBalanceAfterFaucet", {
					network,
					balance: balanceInIota.toFixed(2),
					required: requiredInIota.toFixed(2),
					walletAddress
				}),
				2
			);
		}
	}

	return balanceInNanos;
}

/**
 * Handle dry run validation and display.
 * @param contractName Name of the contract.
 * @param contractData Contract data.
 * @param config Network configuration.
 * @param network Target network.
 * @param faucetUrl The faucet URL (optional, defaults to network-specific URL).
 * @param deployerMnemonic The deployer mnemonic from environment variables.
 * @param deployerSeed The deployer seed from environment variables (optional).
 */
async function handleDryRunValidation(
	contractName: string,
	contractData: IContractData,
	config: INetworkConfig,
	network: NetworkTypes,
	faucetUrl?: string,
	deployerMnemonic?: string,
	deployerSeed?: string
): Promise<void> {
	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.dryRunWouldDeploy"),
		`${contractName} (${network})`,
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.dryRunPackageId"),
		contractData.packageId,
		1
	);
	CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.dryRunRpcUrl"), config.rpc.url, 1);

	try {
		const walletAddress = await validateEnvironmentForNetwork(
			network,
			config,
			true,
			faucetUrl,
			deployerMnemonic,
			deployerSeed
		);
		await checkWalletBalance(network, config, walletAddress, true);
	} catch (err) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.warning"),
			I18n.formatMessage("commands.deploy.labels.environmentValidationWarning", {
				message: (err as Error).message
			}),
			2
		);
	}
}

/**
 * Handle actual deployment execution.
 * @param contractName Name of the contract.
 * @param contractData Contract data.
 * @param config Network configuration.
 * @param network Target network.
 * @param faucetUrl The faucet URL (optional, defaults to network-specific URL).
 * @param deployerMnemonic The deployer mnemonic from environment variables.
 * @param deployerSeed The deployer seed from environment variables (optional).
 */
async function handleActualDeployment(
	contractName: string,
	contractData: IContractData,
	config: INetworkConfig,
	network: NetworkTypes,
	faucetUrl?: string,
	deployerMnemonic?: string,
	deployerSeed?: string
): Promise<void> {
	try {
		const walletAddress = await validateEnvironmentForNetwork(
			network,
			config,
			false,
			faucetUrl,
			deployerMnemonic,
			deployerSeed
		);
		await checkWalletBalance(network, config, walletAddress, false);

		const deploymentResult = await deployWithIotaCli(config.deployment.gasBudget);

		contractData.deployedPackageId = deploymentResult.packageId;
		contractData.upgradeCapabilityId = deploymentResult.upgradeCap;

		if (deploymentResult.migrationStateId) {
			contractData.migrationStateId = deploymentResult.migrationStateId;
		}

		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.deployedPackageIdResult"),
			deploymentResult.packageId,
			1
		);
		if (deploymentResult.upgradeCap) {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.upgradeCapabilityIdResult"),
				deploymentResult.upgradeCap,
				1
			);
		}
		if (contractData.migrationStateId) {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.migrationStateIdResult"),
				contractData.migrationStateId,
				1
			);
		}
	} catch (err) {
		throw new GeneralError(
			"commands",
			"commands.deploy.deploymentFailed",
			{ contract: contractName },
			err
		);
	}
}

/**
 * Deploy a single contract.
 * @param contractName Name of the contract
 * @param contractData Contract compilation data
 * @param contractData.packageId Package ID
 * @param contractData.packageBytecode Package bytecode
 * @param contractData.deployedPackageId Deployed package ID
 * @param config Network configuration
 * @param network Target network
 * @param dryRun Whether this is a dry run
 * @param force Whether to force redeployment
 * @param faucetUrl The faucet URL (optional, defaults to network-specific URL).
 * @param deployerMnemonic The deployer mnemonic from environment variables.
 * @param deployerSeed The deployer seed from environment variables (optional).
 */
async function deployContract(
	contractName: string,
	contractData: IContractData,
	config: INetworkConfig,
	network: NetworkTypes,
	dryRun: boolean,
	force: boolean,
	faucetUrl?: string,
	deployerMnemonic?: string,
	deployerSeed?: string
): Promise<void> {
	CLIDisplay.task(
		I18n.formatMessage("commands.deploy.progress.deployingContract", { contractName, network })
	);

	if (Is.stringValue(contractData.deployedPackageId) && !force) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.contractAlreadyDeployed"),
			contractData.deployedPackageId,
			1
		);
		return;
	}

	if (dryRun) {
		await handleDryRunValidation(
			contractName,
			contractData,
			config,
			network,
			faucetUrl,
			deployerMnemonic,
			deployerSeed
		);
		return;
	}

	await handleActualDeployment(
		contractName,
		contractData,
		config,
		network,
		faucetUrl,
		deployerMnemonic,
		deployerSeed
	);
}

/**
 * Get wallet address for deployment, preferring seed over mnemonic if available.
 * @param network The target network.
 * @param addressIndex The address index to derive.
 * @param deployerMnemonic The deployer mnemonic from environment variables.
 * @param deployerSeed The deployer seed from environment variables (optional).
 * @returns The wallet address.
 */
async function getDeploymentWalletAddress(
	network: NetworkTypes,
	addressIndex: number,
	deployerMnemonic?: string,
	deployerSeed?: string
): Promise<string> {
	// Try to use seed first if available
	const hexSeed = await getDeploymentSeed(network, deployerSeed);
	let seed: Uint8Array | undefined;
	if (Is.stringValue(hexSeed)) {
		seed = Converter.hexToBytes(hexSeed);
	} else {
		const mnemonic = await getDeploymentMnemonic(network, deployerMnemonic);
		seed = Bip39.mnemonicToSeed(mnemonic);
	}

	const addresses = Iota.getAddresses(seed, Iota.DEFAULT_COIN_TYPE, 0, addressIndex, 1, false);

	return addresses[0];
}

/**
 * Convert nanos to IOTA (1 IOTA = 1,000,000,000 nanos).
 * @param nanos Balance in nanos.
 * @returns Balance in IOTA.
 */
function nanosToIota(nanos: number): number {
	return nanos / 1_000_000_000;
}

/**
 * Request funds from the faucet for testnet or devnet deployment.
 * @param network The target network (testnet or devnet).
 * @param walletAddress The wallet address to fund.
 * @param rpcUrl The RPC URL for the network.
 * @param faucetUrl The faucet URL (optional, defaults to network-specific URL).
 * @returns Promise that resolves when funding is complete.
 */
async function requestFaucetFunds(
	network: NetworkTypes,
	walletAddress: string,
	rpcUrl: string,
	faucetUrl: string
): Promise<void> {
	CLIDisplay.task(
		I18n.formatMessage("commands.deploy.progress.requestingFaucetFunds", { network })
	);

	const response = await requestIotaFromFaucetV0({
		host: faucetUrl,
		recipient: walletAddress
	});

	if (response?.error) {
		throw new GeneralError("commands", "commands.deploy.fundingFailed", undefined, response.error);
	}

	const client = new IotaClient({ url: rpcUrl });
	const balanceResponse = await client.getBalance({ owner: walletAddress });
	const balanceInNanos = Number(balanceResponse.totalBalance);

	if (balanceInNanos > 0) {
		const amountInIota = nanosToIota(balanceInNanos);
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.faucetFundsRequested"),
			`${amountInIota.toFixed(2)} IOTA`,
			1
		);
	} else {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.warning"),
			I18n.formatMessage("commands.deploy.labels.faucetNoFundsAdded", { network }),
			2
		);
	}
}

/**
 * Check wallet balance and request faucet funds only if needed.
 * @param network The target network (testnet or devnet).
 * @param config Network configuration.
 * @param walletAddress The wallet address to check and potentially fund.
 * @param faucetUrl The faucet URL (optional, defaults to network-specific URL).
 * @returns Promise that resolves when balance check and optional funding is complete.
 */
async function checkBalanceAndRequestFaucetIfNeeded(
	network: NetworkTypes,
	config: INetworkConfig,
	walletAddress: string,
	faucetUrl?: string
): Promise<void> {
	// Check current balance
	const client = new IotaClient({ url: config.rpc.url });
	const balanceResponse = await client.getBalance({ owner: walletAddress });
	const balanceInNanos = Number(balanceResponse.totalBalance);
	const requiredInNanos = config.deployment.gasBudget;
	// Convert to IOTA for display purposes
	const balanceInIota = nanosToIota(balanceInNanos);
	const requiredInIota = nanosToIota(requiredInNanos);

	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.walletBalance"),
		`${balanceInIota.toFixed(2)} IOTA`,
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.gasBudget"),
		`${requiredInIota.toFixed(2)} IOTA`,
		1
	);

	// Only request faucet funds if balance is insufficient (compare in same units - nanos)
	if (balanceInNanos < requiredInNanos) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.warning"),
			I18n.formatMessage("commands.deploy.labels.insufficientBalance", {
				currentBalance: balanceInIota.toFixed(2),
				requiredBalance: requiredInIota.toFixed(2)
			}),
			1
		);

		if (!Is.stringValue(faucetUrl)) {
			throw new GeneralError("commands", "error.commands.deploy.noFaucetConfigured");
		}

		CLIDisplay.task(I18n.formatMessage("commands.deploy.progress.requestingAdditionalFaucetFunds"));
		await requestFaucetFunds(network, walletAddress, config.rpc.url, faucetUrl);

		// Check balance again after faucet request
		const updatedBalanceResponse = await client.getBalance({ owner: walletAddress });
		const updatedBalanceInNanos = Number(updatedBalanceResponse.totalBalance);
		const updatedBalanceInIota = nanosToIota(updatedBalanceInNanos);
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.updatedWalletBalance"),
			`${updatedBalanceInIota.toFixed(2)} IOTA`,
			1
		);
	} else {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.balanceCheck"),
			I18n.formatMessage("commands.deploy.labels.sufficientFundsAvailable"),
			1
		);
	}
}

/**
 * Deploy contract using IOTA CLI.
 * @param gasBudget Gas budget for deployment.
 * @returns Deployment result with package ID, upgrade cap, and migration state ID.
 */
async function deployWithIotaCli(
	gasBudget: number
): Promise<{ packageId: string; upgradeCap?: string; migrationStateId?: string }> {
	// Find the Move project directory
	const moveTomlPaths: string[] = [];
	await searchDirectoryForMoveToml(process.cwd(), moveTomlPaths);

	if (moveTomlPaths.length === 0) {
		throw new GeneralError("commands", "commands.deploy.noMoveTomlFilesFound", {
			currentDir: process.cwd()
		});
	}

	// Prioritize Move.toml in current directory, then use first found
	const currentDirMoveToml = path.join(process.cwd(), "Move.toml");
	const selectedMoveToml = moveTomlPaths.find(p => p === currentDirMoveToml) ?? moveTomlPaths[0];

	// Use the actual Move project directory
	const moveProjectRoot = path.dirname(selectedMoveToml);

	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.moveProjectRoot"),
		moveProjectRoot,
		1
	);

	const publishCmd = `iota client publish --gas-budget ${gasBudget} --json`;

	CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.publishCommand"), publishCmd, 1);
	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.workingDirectory"),
		moveProjectRoot,
		1
	);

	const { stdout: output } = await execAsync(publishCmd, { cwd: moveProjectRoot });
	const result = JSON.parse(output);

	// Extract package ID from published object
	const packageId = result.objectChanges?.find(
		(change: { type: string; packageId?: string }) => change.type === "published"
	)?.packageId;

	if (!packageId) {
		throw new GeneralError("commands", "commands.deploy.packageIdNotFound", {
			result
		});
	}

	// Extract UpgradeCap ID from created objects
	const upgradeCap = result.objectChanges?.find(
		(change: { objectType?: string; objectId?: string }) =>
			change.objectType === "0x2::package::UpgradeCap"
	)?.objectId;

	// Extract MigrationState ID from created objects
	const migrationStateId = result.objectChanges?.find(
		(change: { objectType?: string; objectId?: string }) =>
			change.objectType?.endsWith("::MigrationState")
	)?.objectId;

	return {
		packageId,
		upgradeCap,
		migrationStateId
	};
}

/**
 * Update contracts file with deployed package IDs.
 * @param contractsPath Path to contracts file.
 * @param contractsData Updated contracts data.
 */
async function updateContractsFile(
	contractsPath: string,
	contractsData: ISmartContractDeployments
): Promise<void> {
	try {
		await CLIUtils.writeJsonFile(contractsPath, contractsData, false);
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.updatedContractsFile"),
			contractsPath,
			1
		);
	} catch (err) {
		throw new GeneralError(
			"commands",
			"commands.deploy.contractsFileUpdateFailed",
			{ contractsPath },
			err
		);
	}
}

/**
 * Generate a unique backup alias that doesn't conflict with existing keys.
 * Uses cryptographically secure random bytes to avoid conflicts.
 * @param baseAlias The original alias name.
 * @param existingKeys Array of existing keys from keystore.
 * @returns A unique backup alias name.
 */
export function generateUniqueBackupAlias(
	baseAlias: string,
	existingKeys: { alias: string; iotaAddress: string }[]
): string {
	const existingAliases = new Set(existingKeys.map(key => key.alias));

	// Generate cryptographically secure random identifier
	const randomSuffix = Converter.bytesToHex(RandomHelper.generate(4));
	const backupAlias = `${baseAlias}-backup-${randomSuffix}`;

	// In the extremely unlikely event of collision, add timestamp
	if (existingAliases.has(backupAlias)) {
		return `${baseAlias}-backup-${Date.now()}-${randomSuffix}`;
	}

	return backupAlias;
}

/**
 * Ensure the correct deployer key exists in the keystore with the expected address.
 * If a conflicting alias exists, rename it and import the correct key.
 * @param network The target network.
 * @param aliasName The desired alias name (e.g., "deployer-testnet").
 * @param expectedAddress The expected address from the current mnemonic.
 * @param addressIndex The address index to use.
 * @param deployerMnemonic The deployer mnemonic.
 */
export async function ensureCorrectDeployerKey(
	network: NetworkTypes,
	aliasName: string,
	expectedAddress: string,
	addressIndex: number,
	deployerMnemonic: string
): Promise<void> {
	try {
		// Check if the alias already exists in keystore
		const { stdout: keysListOutput } = await execAsync("iota keytool list --json");
		const keysList = JSON.parse(keysListOutput);

		// Find existing key with the target alias
		const existingKey = keysList.find(
			(key: { alias: string; iotaAddress: string }) => key.alias === aliasName
		);

		if (existingKey) {
			// Check if existing key has the correct address
			const existingAddress = existingKey.iotaAddress;

			if (existingAddress !== expectedAddress) {
				// Conflicting alias exists with wrong mnemonic - rename it
				CLIDisplay.task(
					I18n.formatMessage("commands.deploy.progress.renamingConflictingKey", { aliasName })
				);

				const backupAlias = generateUniqueBackupAlias(aliasName, keysList);
				await execAsync(`iota keytool update-alias "${aliasName}" "${backupAlias}"`);

				CLIDisplay.value(
					I18n.formatMessage("commands.deploy.labels.renamedExistingKey"),
					`${aliasName} → ${backupAlias} (${existingAddress})`,
					1
				);

				// Now import the correct key with the desired alias
				await importCorrectDeployerKey(
					network,
					aliasName,
					addressIndex,
					expectedAddress,
					deployerMnemonic
				);
			} else {
				// Existing key is correct - no action needed
				CLIDisplay.value(
					I18n.formatMessage("commands.deploy.labels.usingExistingCorrectKey"),
					`${aliasName} (${expectedAddress})`,
					1
				);
			}
		} else {
			// No existing alias - import the key
			await importCorrectDeployerKey(
				network,
				aliasName,
				addressIndex,
				expectedAddress,
				deployerMnemonic
			);
		}

		// Verify the address exists in client addresses
		const { stdout: addressListOutput } = await execAsync("iota client addresses --json");
		const addressInfo = JSON.parse(addressListOutput);
		const addressExists: boolean = addressInfo.addresses.some(
			([_, addr]: [string, string]) => addr === expectedAddress
		);

		if (!addressExists) {
			throw new GeneralError("commands", "commands.deploy.addressNotInClient", {
				expectedAddress,
				aliasName
			});
		}
	} catch (error) {
		throw new GeneralError(
			"commands",
			"commands.deploy.deployerKeySetupFailed",
			{ network, aliasName, expectedAddress },
			error
		);
	}
}

/**
 * Import the deployer key with the correct mnemonic.
 * @param network The target network.
 * @param aliasName The alias name to use.
 * @param addressIndex The address index.
 * @param targetAddress The expected target address (avoids redundant calculation).
 * @param deployerMnemonic The deployer mnemonic.
 */
async function importCorrectDeployerKey(
	network: NetworkTypes,
	aliasName: string,
	addressIndex: number,
	targetAddress: string,
	deployerMnemonic: string
): Promise<void> {
	CLIDisplay.task(
		I18n.formatMessage("commands.deploy.progress.importingDeployerKey", { aliasName })
	);

	const mnemonic = await getDeploymentMnemonic(network, deployerMnemonic);
	const derivationPath = Bip44.path(Iota.DEFAULT_COIN_TYPE, 0, false, addressIndex).toString();

	await execAsync(
		`iota keytool import "${mnemonic}" ed25519 "${derivationPath}" --alias "${aliasName}"`
	);

	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.importedDeployerKey"),
		`${aliasName} (${targetAddress})`,
		1
	);
}
