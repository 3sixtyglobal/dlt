// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClientOptions } from "@iota/iota-sdk/client";
import type { IAccountConfig } from "@twin.org/dlt-account";
import type { IGasStationConfig } from "./IGasStationConfig.js";

/**
 * Configuration for IOTA.
 */
export interface IIotaConfig extends IAccountConfig {
	/**
	 * The configuration for the client.
	 */
	clientOptions: IotaClientOptions;

	/**
	 * The network the operations are being performed on.
	 */
	network: string;

	/**
	 * The length of time to wait for the inclusion of a transaction in seconds.
	 * @default 60
	 */
	inclusionTimeoutSeconds?: number;

	/**
	 * Gas station configuration for sponsored transactions.
	 * If provided, transactions will be processed through the gas station.
	 */
	gasStation?: IGasStationConfig;

	/**
	 * The default gas budget for all transactions (including sponsored and direct).
	 * @default 50000000
	 */
	gasBudget?: number;

	/**
	 * The default gas reservation duration in seconds for all transactions (including sponsored and direct).
	 * @default 60
	 */
	gasReservationDuration?: number;

	/**
	 * Enable cost logging for transactions.
	 * @default false
	 */
	enableCostLogging?: boolean;

	/**
	 * The number of times to retry a transaction that is rejected because one or more of its owned
	 * objects is reserved by another in-flight transaction.
	 * @default 3
	 */
	objectLockRetries?: number;

	/**
	 * The base delay in milliseconds between object-lock retries; the delay grows exponentially
	 * with each attempt.
	 * @default 1000
	 */
	objectLockRetryDelayMs?: number;
}
