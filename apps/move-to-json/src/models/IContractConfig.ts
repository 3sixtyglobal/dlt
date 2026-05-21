// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Contract configuration interface
 */
export interface IContractConfig {
	/**
	 * The module name
	 */
	moduleName: string;
	/**
	 * The dependencies
	 */
	dependencies?: string[];
	/**
	 * The package controller configuration
	 */
	packageController?: {
		addressIndex: number;
	};
}
