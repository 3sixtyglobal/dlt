// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The configuration for an account.
 */
export interface IAccountConfig {
	/**
	 * The ID of the vault seed.
	 */
	vaultSeedId?: string;

	/**
	 * The ID of the vault mnemonic.
	 */
	vaultMnemonicId?: string;

	/**
	 * The coin type.
	 */
	coinType?: number;

	/**
	 * The maximum number of addresses to scan for the account.
	 */
	maxAddressScanRange?: number;
}
