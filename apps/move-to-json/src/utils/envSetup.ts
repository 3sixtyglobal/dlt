// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Is } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import type { NetworkTypes } from "@twin.org/dlt-iota";

/**
 * Validate that required environment variables are set for deployment.
 * @param network The target network.
 * @param deployerMnemonic The deployer mnemonic to validate.
 * @throws GeneralError if required environment variables are missing.
 */
export async function validateDeploymentEnvironment(
	network: NetworkTypes,
	deployerMnemonic: string
): Promise<void> {
	await getDeploymentMnemonic(network, deployerMnemonic);
}

/**
 * Get the deployment mnemonic for a network.
 * @param network The target network.
 * @param deployerMnemonic The deployer mnemonic from environment variables.
 * @returns The mnemonic string.
 * @throws GeneralError if mnemonic is not found or invalid.
 */
export async function getDeploymentMnemonic(
	network: NetworkTypes,
	deployerMnemonic?: string
): Promise<string> {
	if (!Is.stringValue(deployerMnemonic)) {
		throw new GeneralError("envSetup", "mnemonicMissing", {
			network,
			mnemonicVar: "DEPLOYER_MNEMONIC"
		});
	}

	// Validate mnemonic format using Bip39 validation
	if (!Bip39.validateMnemonic(deployerMnemonic)) {
		throw new GeneralError("envSetup", "mnemonicInvalidFormat", {
			network,
			mnemonicVar: "DEPLOYER_MNEMONIC"
		});
	}

	return deployerMnemonic;
}

/**
 * Get the deployment seed for a network (if available).
 * @param network The target network.
 * @param deployerSeed The deployer seed from environment variables (optional).
 * @returns The seed string or undefined if not set.
 * @throws GeneralError if seed is not found or invalid.
 */
export async function getDeploymentSeed(
	network: NetworkTypes,
	deployerSeed?: string
): Promise<string | undefined> {
	if (!Is.stringValue(deployerSeed)) {
		return undefined;
	}

	if (!Is.stringHexLength(deployerSeed, 64, true)) {
		throw new GeneralError("envSetup", "seedInvalidFormat", {
			network,
			seedVar: "DEPLOYER_SEED"
		});
	}

	return deployerSeed;
}
