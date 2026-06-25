// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IContractData, ISmartContractDeployments } from "@twin.org/dlt-iota";
import {
	buildV1Contract,
	buildV2Contract,
	buildV3Contract,
	cleanupTestArtifacts,
	deployV1Contract,
	loadDeploymentConfig,
	upgradeToV2UsingSmartDeploy,
	upgradeToV3UsingSmartDeploy
} from "./helpers/upgradeTestHelpers.js";
import {
	TEST_DEPLOYMENT_JSON_V2,
	TEST_DEPLOYMENT_JSON_V3,
	TEST_NETWORK,
	cleanupTestEnv,
	setupTestEnv
} from "./setupTestEnv.js";

/**
 * Double Upgrade Test (V1 → V2 → V3)
 *
 * This test validates that the full upgrade chain works correctly:
 * V1 deploy → V2 upgrade → V3 upgrade.
 *
 * The IOTA UpgradeCap.package field is updated to the latest package on each
 * upgrade, so published-at (derived from lastDeployedPackageId) must always
 * be the latest deployed package ID, not the original.
 */
describe("Double Upgrade V1 → V2 → V3", () => {
	let v1Deployment: IContractData;
	let v2Deployment: IContractData;

	beforeAll(async () => {
		console.debug("Setting up double upgrade test environment");
		await setupTestEnv();
		await cleanupTestArtifacts();
		console.debug("Double upgrade test environment setup completed");
	}, 300000);

	afterAll(async () => {
		console.debug("Cleaning up double upgrade test environment");
		await cleanupTestEnv();
		console.debug("Double upgrade test environment cleanup completed");
	});

	describe("Step 1: Deploy V1", () => {
		it("should build V1 contract", async () => {
			await buildV1Contract();
		}, 180000);

		it("should deploy V1 contract (initial deploy)", async () => {
			v1Deployment = await deployV1Contract();

			expect(v1Deployment.deployedPackageId).toBeDefined();
			expect(v1Deployment.upgradeCapabilityId).toBeDefined();
			console.debug(`[doubleUpgrade] V1 deployed at: ${v1Deployment.deployedPackageId}`);
		}, 180000);
	});

	describe("Step 2: Upgrade V1 → V2", () => {
		it("should build V2 contract with V1 upgrade capability", async () => {
			await buildV2Contract(v1Deployment);

			const v2Data = await loadDeploymentConfig(TEST_DEPLOYMENT_JSON_V2);
			const contractData = v2Data[TEST_NETWORK as keyof ISmartContractDeployments];

			// After build, deployedPackageId should be cleared (bytecode changed)
			expect(contractData?.deployedPackageId).toBeUndefined();
			// lastDeployedPackageId should be set to original V1 deployment
			expect(contractData?.lastDeployedPackageId).toBe(v1Deployment.deployedPackageId);
			// upgradeCapabilityId should be preserved
			expect(contractData?.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId);
		}, 180000);

		it("should upgrade V1 → V2 successfully", async () => {
			v2Deployment = await upgradeToV2UsingSmartDeploy();

			expect(v2Deployment.deployedPackageId).toBeDefined();
			// V2 deployed package should be different from V1
			expect(v2Deployment.deployedPackageId).not.toBe(v1Deployment.deployedPackageId);
			// upgradeCapabilityId should be preserved
			expect(v2Deployment.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId);
			console.debug(`[doubleUpgrade] V2 deployed at: ${v2Deployment.deployedPackageId}`);
			console.debug(
				`[doubleUpgrade] V2 lastDeployedPackageId: ${v2Deployment.lastDeployedPackageId}`
			);
		}, 180000);
	});

	describe("Step 3: Upgrade V2 → V3", () => {
		it("should build V3 contract with lastDeployedPackageId set to latest (V2)", async () => {
			await buildV3Contract(v2Deployment);

			const v3Data = await loadDeploymentConfig(TEST_DEPLOYMENT_JSON_V3);
			const contractData = v3Data[TEST_NETWORK as keyof ISmartContractDeployments];

			// lastDeployedPackageId must be the LATEST deployed package (V2),
			// because UpgradeCap.package is updated to the latest on each upgrade,
			// and published-at must match it.
			expect(contractData?.lastDeployedPackageId).toBe(v2Deployment.deployedPackageId);

			// deployedPackageId should be cleared (bytecode changed)
			expect(contractData?.deployedPackageId).toBeUndefined();

			// upgradeCapabilityId should be preserved
			expect(contractData?.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId);

			console.debug(
				`[doubleUpgrade] V3 lastDeployedPackageId: ${contractData?.lastDeployedPackageId}`
			);
		}, 180000);

		it("should upgrade V2 → V3 successfully", async () => {
			const v3Deployment = await upgradeToV3UsingSmartDeploy();

			// V3 upgrade should succeed
			expect(v3Deployment.deployedPackageId).toBeDefined();
			// V3 deployed package should be different from V2
			expect(v3Deployment.deployedPackageId).not.toBe(v2Deployment.deployedPackageId);
			// upgradeCapabilityId should be preserved through all upgrades
			expect(v3Deployment.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId);

			console.debug(`[doubleUpgrade] V3 deployed at: ${v3Deployment.deployedPackageId}`);
			console.debug("[doubleUpgrade] Double upgrade V1 → V2 → V3 completed successfully!");
		}, 180000);
	});
});
