// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IContractData, ISmartContractDeployments } from "@twin.org/dlt-iota";
import {
	buildV1Contract,
	deployV1Contract,
	buildV2Contract,
	upgradeToV2UsingSmartDeploy,
	cleanupTestArtifacts,
	loadDeploymentConfig
} from "./helpers/upgradeTestHelpers.js";
import {
	TEST_NETWORK,
	TEST_DEPLOYMENT_JSON_V1,
	TEST_DEPLOYMENT_JSON_V2,
	setupTestEnv,
	cleanupTestEnv
} from "./setupTestEnv.js";

describe("Smart Deploy Upgrade Functionality", () => {
	let v1Deployment: IContractData;
	let v2Deployment: IContractData;

	beforeAll(async () => {
		console.debug("Setting up smart deploy upgrade test environment");
		await setupTestEnv();
		await cleanupTestArtifacts();
		console.debug("Smart deploy upgrade test environment setup completed");
	}, 300000); // 5 minute timeout for setup

	afterAll(async () => {
		console.debug("Cleaning up smart deploy upgrade test environment");
		await cleanupTestEnv();
		console.debug("Smart deploy upgrade test environment cleanup completed");
	});

	describe("V1 Contract Initial Deployment", () => {
		it("should build V1 contract with move-to-json build", async () => {
			console.debug("Starting V1 contract build test");
			await buildV1Contract();

			// Verify deployment JSON structure was populated
			const deploymentData = await loadDeploymentConfig(TEST_DEPLOYMENT_JSON_V1);
			const contractData = deploymentData[TEST_NETWORK as keyof ISmartContractDeployments];

			expect(contractData).toBeDefined();
			expect(contractData?.packageId).toBeDefined();
			expect(contractData?.packageBytecode).toBeDefined();
			expect(contractData?.packageId).not.toBe("");
			expect(contractData?.packageBytecode).not.toBe("");

			console.debug("V1 contract build test completed successfully");
		}, 180000); // 3 minute timeout

		it("should deploy V1 contract using smart deploy (initial deployment)", async () => {
			console.debug("Starting V1 contract deployment test");
			v1Deployment = await deployV1Contract();

			expect(v1Deployment.deployedPackageId).toBeDefined();
			expect(v1Deployment.upgradeCapabilityId).toBeDefined();
			// migrationStateId is optional for initial deployments
			expect(v1Deployment.lastDeployedPackageId).toBeUndefined();

			console.debug(`V1 deployment completed: ${v1Deployment.deployedPackageId}`);
			console.debug(`Upgrade capability: ${v1Deployment.upgradeCapabilityId}`);
		}, 240000); // 4 minute timeout

		it("should detect 'initial-deploy' strategy for fresh deployment", async () => {
			// The fact that V1 deployment succeeded with upgrade capability proves initial-deploy strategy worked
			expect(v1Deployment.upgradeCapabilityId).toBeDefined();
			expect(v1Deployment.deployedPackageId).toBeDefined();
			expect(v1Deployment.lastDeployedPackageId).toBeUndefined();
			// migrationStateId is optional for initial deployments
		});

		it("should detect 'already-deployed' strategy when no changes", async () => {
			console.debug("Testing already-deployed strategy detection");

			// Deploy again without changes - should detect already-deployed
			const secondDeployment = await deployV1Contract();

			// Should be the same deployment data (no changes)
			expect(secondDeployment.deployedPackageId).toBe(v1Deployment.deployedPackageId);
			expect(secondDeployment.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId);
			expect(secondDeployment.lastDeployedPackageId).toBeUndefined();

			console.debug("Already-deployed strategy test completed");
		}, 240000); // 4 minute timeout
	});

	describe("V2 Contract Smart Upgrade", () => {
		it("should build V2 contract with bytecode changes", async () => {
			console.debug("Starting V2 contract build test");
			await buildV2Contract(v1Deployment);

			// Verify deployment JSON shows upgrade scenario
			const deploymentData = await loadDeploymentConfig(TEST_DEPLOYMENT_JSON_V2);
			const contractData = deploymentData[TEST_NETWORK as keyof ISmartContractDeployments];

			expect(contractData).toBeDefined();
			expect(contractData?.packageId).toBeDefined();
			expect(contractData?.packageBytecode).toBeDefined();
			expect(contractData?.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId); // Preserved
			expect(contractData?.migrationStateId).toBe(v1Deployment.migrationStateId); // Preserved
			expect(contractData?.deployedPackageId).toBeUndefined(); // Cleared because bytecode changed - signals upgrade needed
			expect(contractData?.lastDeployedPackageId).toBe(v1Deployment.deployedPackageId); // Tracked previous

			console.debug("V2 contract build test completed successfully");
		}, 180000); // 3 minute timeout

		it("should detect 'upgrade' strategy for bytecode changes", async () => {
			// The build process should have preserved upgrade capability but updated bytecode
			const deploymentData = await loadDeploymentConfig(TEST_DEPLOYMENT_JSON_V2);
			const contractData = deploymentData[TEST_NETWORK as keyof ISmartContractDeployments];

			// Should have upgrade capability (indicating upgrade scenario)
			expect(contractData?.upgradeCapabilityId).toBeDefined();
			expect(contractData?.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId);

			// Should have different package bytecode (new version)
			expect(contractData?.packageBytecode).not.toBe(v1Deployment.packageBytecode);
		});

		it("should perform V1→V2 upgrade using smart deploy", async () => {
			console.debug("Starting smart deploy upgrade test");
			v2Deployment = await upgradeToV2UsingSmartDeploy();

			// Verify upgrade was successful
			expect(v2Deployment.deployedPackageId).toBeDefined();
			expect(v2Deployment.deployedPackageId).not.toBe(v1Deployment.deployedPackageId); // New package ID
			expect(v2Deployment.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId); // Preserved
			expect(v2Deployment.migrationStateId).toBe(v1Deployment.migrationStateId); // Preserved
			expect(v2Deployment.lastDeployedPackageId).toBe(v1Deployment.deployedPackageId); // Tracked previous

			console.debug(`V2 upgrade completed: ${v2Deployment.deployedPackageId}`);
			console.debug(`Previous deployment tracked: ${v2Deployment.lastDeployedPackageId}`);
		}, 240000); // 4 minute timeout

		it("should preserve upgrade capability across upgrade", async () => {
			// Verify upgrade capability chain is maintained
			expect(v2Deployment.upgradeCapabilityId).toBe(v1Deployment.upgradeCapabilityId);
			expect(v2Deployment.upgradeCapabilityId).toBeDefined();

			// Should still have migration state preserved
			expect(v2Deployment.migrationStateId).toBe(v1Deployment.migrationStateId);
		});

		it("should track previous deployment for rollback capability", async () => {
			// Verify lastDeployedPackageId tracking
			expect(v2Deployment.lastDeployedPackageId).toBe(v1Deployment.deployedPackageId);
			expect(v2Deployment.lastDeployedPackageId).toBeDefined();

			// V1 should not have had a previous deployment
			expect(v1Deployment.lastDeployedPackageId).toBeUndefined();
		});
	});

	describe("Edge Cases and Error Scenarios", () => {
		it("should handle deployment data validation", async () => {
			// Verify our deployment data has all required fields
			expect(v1Deployment.packageId).toBeDefined();
			expect(v1Deployment.packageBytecode).toBeDefined();
			expect(v1Deployment.deployedPackageId).toBeDefined();
			expect(v1Deployment.upgradeCapabilityId).toBeDefined();
			// migrationStateId is optional for initial deployments

			expect(v2Deployment.packageId).toBeDefined();
			expect(v2Deployment.packageBytecode).toBeDefined();
			expect(v2Deployment.deployedPackageId).toBeDefined();
			expect(v2Deployment.upgradeCapabilityId).toBeDefined();
			// migrationStateId is optional for deployments
			expect(v2Deployment.lastDeployedPackageId).toBeDefined();
		});

		it("should have different package IDs for V1 and V2", async () => {
			// Verify the upgrade actually created a new package
			expect(v1Deployment.deployedPackageId).not.toBe(v2Deployment.deployedPackageId);
			expect(v1Deployment.packageId).not.toBe(v2Deployment.packageId);
		});

		it("should have different bytecode for V1 and V2", async () => {
			// Verify the contracts are actually different
			expect(v1Deployment.packageBytecode).not.toBe(v2Deployment.packageBytecode);
		});
	});
});
