// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * On-chain object IDs for an identity and its associated controller token.
 */
export interface IIotaControllerCapInfo {
	/**
	 * The on-chain object ID of the Identity Move object (hex string, e.g. "0x...").
	 */
	identityObjectId: string;

	/**
	 * The on-chain object ID of the ControllerToken Move object (hex string, e.g. "0x...").
	 */
	controllerCapObjectId: string;
}
