// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { requestIotaFromFaucetV0 } from "@iota/iota-sdk/faucet";
import { Guards, Is } from "@twin.org/core";
import dotenv from "dotenv";
import { Iota } from "../src/iota.js";

console.debug("Setting up test environment from .env and .env.dev files");

dotenv.config({
	path: [path.join(__dirname, ".env.dev"), path.join(__dirname, ".env")],
	quiet: true
});

Guards.stringValue("TestEnv", "TEST_NODE_ENDPOINT", process.env.TEST_NODE_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_FAUCET_ENDPOINT", process.env.TEST_FAUCET_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_NETWORK", process.env.TEST_NETWORK);
Guards.stringValue("TestEnv", "TEST_EXPLORER_URL", process.env.TEST_EXPLORER_URL);

export const TEST_CLIENT_OPTIONS = {
	url: process.env.TEST_NODE_ENDPOINT ?? ""
};

export const TEST_COIN_TYPE = Iota.DEFAULT_COIN_TYPE;
export const TEST_NETWORK = process.env.TEST_NETWORK;

// Test data constants
export const TEST_MNEMONIC =
	"undo boss jewel dog announce mistake cry brass stock debris arrest patrol recipe annual clown honey icon twist modify quarter warm lock anchor cigar";
export const TEST_IDENTITY = "test-identity";

// Gas station environment variables
export const GAS_STATION_URL = process.env.GAS_STATION_URL ?? "http://localhost:9527";
export const GAS_STATION_AUTH_TOKEN =
	process.env.GAS_STATION_AUTH_TOKEN ?? "qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI=";
export const GAS_BUDGET = Number.parseInt(process.env.GAS_BUDGET ?? "50000000", 10);
export const TEST_FAUCET_ENDPOINT = process.env.TEST_FAUCET_ENDPOINT;
export const TEST_EXPLORER_URL = process.env.TEST_EXPLORER_URL;
export const TEST_GAS_STATION_ADDRESS = process.env.TEST_GAS_STATION_ADDRESS;

/**
 * Setup the test environment.
 */
export async function setupTestEnv(): Promise<void> {
	// Fund the gas station if its address is provided
	if (Is.stringValue(TEST_GAS_STATION_ADDRESS) && Is.stringValue(TEST_FAUCET_ENDPOINT)) {
		try {
			console.debug(
				"Requesting IOTA from faucet to fund gas station address:",
				TEST_GAS_STATION_ADDRESS
			);
			const response = await requestIotaFromFaucetV0({
				host: TEST_FAUCET_ENDPOINT,
				recipient: TEST_GAS_STATION_ADDRESS
			});
			console.debug("Funded gas station address from faucet:", response);
		} catch (error) {
			console.error("Failed to request IOTA from faucet:", error);
		}
		console.debug(
			"Gas station balance",
			await Iota.getBalance(
				{
					clientOptions: TEST_CLIENT_OPTIONS,
					network: TEST_NETWORK
				},
				TEST_GAS_STATION_ADDRESS
			)
		);
	}
}
