// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IContractData } from "./IContractData.js";
import type { NetworkTypes } from "./networkTypes.js";

/**
 * Type for the smart-contract-deployments.json structure, mapping each network to its contract data.
 */
export type ISmartContractDeployments = {
	[K in NetworkTypes]?: IContractData;
};
