// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Generic interface representing the storage fields of a MigrationState object.
 */
export interface IMigrationStateFields {
	/**
	 * The UID wrapper of the MigrationState object.
	 */
	id: {
		/**
		 * The hex string ID of the MigrationState object.
		 */
		id: string;
	};

	/**
	 * Whether migration is currently enabled.
	 */
	enabled: boolean;
}
