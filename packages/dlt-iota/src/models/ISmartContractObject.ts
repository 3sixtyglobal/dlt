// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Base interface for all smart contract objects with versioning support.
 */
export interface ISmartContractObject {
	/**
	 * The UID wrapper of the smart contract object.
	 */
	id: {
		/**
		 * The hex string ID of the smart contract object.
		 */
		id: string;
	};

	/**
	 * The version of the contract that created this object.
	 */
	version: string;
}
