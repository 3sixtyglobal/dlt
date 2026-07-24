// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Resolved parameters for gas station sponsored operations.
 */
export interface IGasStationParams {
	/**
	 * The gas station service URL with any trailing slashes removed.
	 */
	gasStationUrl: string;

	/**
	 * The authentication token for the gas station API.
	 */
	gasStationAuthToken: string;

	/**
	 * The gas budget to reserve and declare on the transaction, in nanos.
	 */
	gasBudget: number;

	/**
	 * The gas reservation duration in seconds.
	 */
	gasReservationDuration: number;
}
