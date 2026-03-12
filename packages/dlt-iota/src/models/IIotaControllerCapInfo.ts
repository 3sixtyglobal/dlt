// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * On-chain object IDs needed to call mint_with_identity() on the NFT Move contract.
 */
export interface IIotaControllerCapInfo {
	/**
	 * The on-chain Object ID of the Identity Move object (hex string, e.g. "0x...").
	 * Used as the Identity argument in mint_with_identity().
	 */
	identityObjectId: string;

	/**
	 * The on-chain Object ID of the ControllerToken Move object (hex string, e.g. "0x...").
	 * Proves that the controller address controls identityObjectId.
	 * Used as the ControllerCap argument in mint_with_identity().
	 */
	controllerCapObjectId: string;
}
