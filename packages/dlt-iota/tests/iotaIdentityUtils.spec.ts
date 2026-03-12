// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	IdentityClient,
	IdentityClientReadOnly,
	OnChainIdentity
} from "@iota/identity-wasm/node/index.js";
import type { IotaClient } from "@iota/iota-sdk/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { IotaIdentityUtils } from "../src/iotaIdentityUtils.js";

// Mock the entire WASM module — static methods are replaced with vi.fn() so
// we can control return values per test without hitting the actual WASM binary.
vi.mock("@iota/identity-wasm/node/index.js", () => ({
	IdentityClientReadOnly: { create: vi.fn() },
	IdentityClient: { create: vi.fn() },
	OnChainIdentity: { getById: vi.fn() }
}));

const MOCK_IDENTITY_ID = "did:iota:testnet:abc123def456abc123def456abc123def456abc1";
const MOCK_IDENTITY_OBJECT_ID = "0xabc123def456abc123def456abc123def456abc1";
const MOCK_CONTROLLER_ADDRESS = "0x1111111111111111111111111111111111111111";
const MOCK_CONTROLLER_CAP_OBJECT_ID = "0x2222222222222222222222222222222222222222";

describe("IotaIdentityUtils", () => {
	// Typed references to the mocked static functions
	const mockReadOnlyCreate = vi.mocked(IdentityClientReadOnly.create);
	const mockClientCreate = vi.mocked(IdentityClient.create);
	const mockGetById = vi.mocked(OnChainIdentity.getById);

	// Shared mock objects
	const mockReadOnlyClient = {};
	const mockIdentityClient = {};

	beforeEach(() => {
		vi.clearAllMocks();

		// Default: client construction always succeeds
		mockReadOnlyCreate.mockResolvedValue(mockReadOnlyClient as never);
		mockClientCreate.mockResolvedValue(mockIdentityClient as never);
	});

	describe("getControllerCapInfo", () => {
		test("returns identityObjectId and controllerCapObjectId on success", async () => {
			const mockOnChainIdentity = {
				hasDeletedDid: vi.fn().mockReturnValue(false),
				getControllerTokenForAddress: vi.fn().mockResolvedValue({
					id: vi.fn().mockReturnValue(MOCK_CONTROLLER_CAP_OBJECT_ID)
				})
			};
			mockGetById.mockResolvedValue(mockOnChainIdentity as never);

			const result = await IotaIdentityUtils.getControllerCapInfo(
				MOCK_IDENTITY_ID,
				MOCK_CONTROLLER_ADDRESS,
				{} as IotaClient
			);

			expect(result.identityObjectId).toBe(MOCK_IDENTITY_OBJECT_ID);
			expect(result.controllerCapObjectId).toBe(MOCK_CONTROLLER_CAP_OBJECT_ID);
			expect(mockOnChainIdentity.getControllerTokenForAddress).toHaveBeenCalledWith(
				MOCK_CONTROLLER_ADDRESS,
				mockIdentityClient
			);
		});

		test("parses identityObjectId correctly from DID", async () => {
			const mockOnChainIdentity = {
				hasDeletedDid: vi.fn().mockReturnValue(false),
				getControllerTokenForAddress: vi.fn().mockResolvedValue({
					id: vi.fn().mockReturnValue(MOCK_CONTROLLER_CAP_OBJECT_ID)
				})
			};
			mockGetById.mockResolvedValue(mockOnChainIdentity as never);

			const result = await IotaIdentityUtils.getControllerCapInfo(
				"did:iota:testnet:abcdef1234",
				MOCK_CONTROLLER_ADDRESS,
				{} as IotaClient
			);

			// Last DID segment prefixed with 0x
			expect(result.identityObjectId).toBe("0xabcdef1234");
			expect(mockGetById).toHaveBeenCalledWith("0xabcdef1234", mockIdentityClient);
		});

		test("throws NotFoundError when identity does not exist on-chain", async () => {
			mockGetById.mockResolvedValue(undefined as never);

			await expect(
				IotaIdentityUtils.getControllerCapInfo(
					MOCK_IDENTITY_ID,
					MOCK_CONTROLLER_ADDRESS,
					{} as IotaClient
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "NotFoundError",
					source: "IotaIdentityUtils",
					message: "iotaIdentityUtils.identityNotFound"
				})
			);
		});

		test("throws GeneralError when identity has been deleted", async () => {
			const mockDeletedIdentity = {
				hasDeletedDid: vi.fn().mockReturnValue(true),
				getControllerTokenForAddress: vi.fn()
			};
			mockGetById.mockResolvedValue(mockDeletedIdentity as never);

			await expect(
				IotaIdentityUtils.getControllerCapInfo(
					MOCK_IDENTITY_ID,
					MOCK_CONTROLLER_ADDRESS,
					{} as IotaClient
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					source: "IotaIdentityUtils",
					message: "iotaIdentityUtils.identityDeleted"
				})
			);

			// getControllerTokenForAddress must not be called for a deleted identity
			expect(mockDeletedIdentity.getControllerTokenForAddress).not.toHaveBeenCalled();
		});

		test("throws NotFoundError when no controller token exists for address", async () => {
			const mockOnChainIdentity = {
				hasDeletedDid: vi.fn().mockReturnValue(false),
				getControllerTokenForAddress: vi.fn().mockResolvedValue(undefined)
			};
			mockGetById.mockResolvedValue(mockOnChainIdentity as never);

			await expect(
				IotaIdentityUtils.getControllerCapInfo(
					MOCK_IDENTITY_ID,
					MOCK_CONTROLLER_ADDRESS,
					{} as IotaClient
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "NotFoundError",
					source: "IotaIdentityUtils",
					message: "iotaIdentityUtils.controllerTokenNotFound"
				})
			);
		});

		test("wraps unexpected SDK errors as GeneralError getControllerCapInfoFailed", async () => {
			mockGetById.mockRejectedValue(new Error("RPC connection refused"));

			await expect(
				IotaIdentityUtils.getControllerCapInfo(
					MOCK_IDENTITY_ID,
					MOCK_CONTROLLER_ADDRESS,
					{} as IotaClient
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					source: "IotaIdentityUtils",
					message: "iotaIdentityUtils.getControllerCapInfoFailed"
				})
			);
		});

		test("throws GuardError when identityId is empty", async () => {
			await expect(
				IotaIdentityUtils.getControllerCapInfo("", MOCK_CONTROLLER_ADDRESS, {} as IotaClient)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					source: "IotaIdentityUtils"
				})
			);
		});

		test("throws GuardError when controllerAddress is empty", async () => {
			await expect(
				IotaIdentityUtils.getControllerCapInfo(MOCK_IDENTITY_ID, "", {} as IotaClient)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GuardError",
					source: "IotaIdentityUtils"
				})
			);
		});
	});
});
