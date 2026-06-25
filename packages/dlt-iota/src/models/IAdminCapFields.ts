// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Generic interface representing the storage fields of an AdminCap object.
 */
export interface IAdminCapFields {
	/**
	 * The UID wrapper of the AdminCap object.
	 */
	id: {
		/**
		 * The hex string ID of the AdminCap object.
		 */
		id: string;
	};
}
