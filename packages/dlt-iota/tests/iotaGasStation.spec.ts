// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Transaction } from "@iota/iota-sdk/transactions";
import { Bip39, Bip44, KeyType } from "@twin.org/crypto";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVaultConnector,
	initSchema,
	type VaultKey,
	type VaultSecret
} from "@twin.org/vault-connector-entity-storage";
import { VaultKeyType } from "@twin.org/vault-models";
import {
	GAS_BUDGET,
	GAS_STATION_AUTH_TOKEN,
	GAS_STATION_URL,
	TEST_CLIENT_OPTIONS,
	TEST_IDENTITY,
	TEST_MNEMONIC,
	TEST_NETWORK
} from "./setupTestEnv.js";
import { Iota, VaultSigner, type IGasStationConfig, type IIotaConfig } from "../src/index.js";

let vaultConnector: EntityStorageVaultConnector;
let testSignerKeyName: string;
let testSignerPublicKey: Uint8Array;

describe("Iota Gas Station Integration", () => {
	const gasStationConfig: IIotaConfig = {
		clientOptions: TEST_CLIENT_OPTIONS,
		network: TEST_NETWORK,
		gasBudget: GAS_BUDGET,
		gasStation: {
			gasStationUrl: GAS_STATION_URL,
			gasStationAuthToken: GAS_STATION_AUTH_TOKEN
		}
	};

	beforeAll(async () => {
		initSchema();

		const keyEntityStorage = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-key" }
		});
		const secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secret" }
		});

		EntityStorageConnectorFactory.register("vault-key", () => keyEntityStorage);
		EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);

		vaultConnector = new EntityStorageVaultConnector();
		await vaultConnector.setSecret(
			`${TEST_IDENTITY}/${Iota.DEFAULT_MNEMONIC_SECRET_NAME}`,
			TEST_MNEMONIC
		);

		const userAddress = await Iota.getAddress(
			vaultConnector,
			gasStationConfig,
			TEST_IDENTITY,
			0,
			0
		);
		const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
		const kp = Bip44.keyPair(seed, KeyType.Ed25519, Iota.DEFAULT_COIN_TYPE, 0, false, 0);
		testSignerKeyName = `${TEST_IDENTITY}/key/${userAddress}`;
		testSignerPublicKey = kp.publicKey;
		await vaultConnector.addKey(
			testSignerKeyName,
			VaultKeyType.Ed25519,
			kp.privateKey,
			kp.publicKey
		);
	});

	// Configuration Tests
	describe("Configuration", () => {
		test("Should create config with gas station configuration", () => {
			const gasStationConfigObj: IGasStationConfig = {
				gasStationUrl: GAS_STATION_URL,
				gasStationAuthToken: GAS_STATION_AUTH_TOKEN
			};

			const config: IIotaConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				gasBudget: GAS_BUDGET,
				gasStation: gasStationConfigObj
			};

			expect(config.gasStation).toBeDefined();
			expect(config.gasStation?.gasStationUrl).toBe(GAS_STATION_URL);
			expect(config.gasStation?.gasStationAuthToken).toBe(GAS_STATION_AUTH_TOKEN);
			expect(config.gasBudget).toBe(GAS_BUDGET);
		});

		test("Should create config without gas station configuration", () => {
			const config: IIotaConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK
			};

			expect(config.gasStation).toBeUndefined();
		});

		test("Should have gas station static methods available", () => {
			expect(typeof Iota.reserveGas).toBe("function");
			expect(typeof Iota.executeGasStationTransaction).toBe("function");
			expect(typeof Iota.prepareAndPostGasStationTransaction).toBe("function");
		});
	});

	describe("Live Integration (requires running gas station)", () => {
		test("Should connect to running gas station", async () => {
			console.log(GAS_STATION_URL);
			const response = await fetch(GAS_STATION_URL, {
				method: "GET"
			});

			expect(response.ok).toBe(true);
		});

		test("Should reserve gas and examine response format", async () => {
			const gasReservation = await Iota.reserveGas(gasStationConfig);

			expect(gasReservation).toHaveProperty("sponsorAddress");
			expect(gasReservation).toHaveProperty("reservationId");
			expect(gasReservation).toHaveProperty("gasCoins");
			expect(typeof gasReservation.sponsorAddress).toBe("string");
			expect(typeof gasReservation.reservationId).toBe("number");
			expect(Array.isArray(gasReservation.gasCoins)).toBe(true);
		});

		test("Should execute transaction via gas station and examine response format", async () => {
			const client = Iota.createClient(gasStationConfig);

			const userAddress = await Iota.getAddress(
				vaultConnector,
				gasStationConfig,
				TEST_IDENTITY,
				0,
				0,
				false
			);

			const gasReservation = await Iota.reserveGas(gasStationConfig);

			const tx = new Transaction();
			tx.moveCall({
				target: "0x2::clock::timestamp_ms",
				arguments: [tx.object("0x6")]
			});

			tx.setSender(userAddress);
			tx.setGasOwner(gasReservation.sponsorAddress);
			tx.setGasPayment(gasReservation.gasCoins);
			tx.setGasBudget(GAS_BUDGET);

			const unsignedTxBytes = await tx.build({ client });

			const signer = new VaultSigner(vaultConnector, testSignerKeyName, testSignerPublicKey);
			const signature = await signer.signTransaction(unsignedTxBytes);

			const gasStationResponse = await Iota.executeGasStationTransaction(
				gasStationConfig,
				gasReservation.reservationId,
				unsignedTxBytes,
				signature.signature
			);

			expect(gasStationResponse).toBeDefined();
		});

		test("Should execute pre-built transaction via gas station with confirmation", async () => {
			const client = Iota.createClient(gasStationConfig);

			const userAddress = await Iota.getAddress(
				vaultConnector,
				gasStationConfig,
				TEST_IDENTITY,
				0,
				0
			);

			const gasReservation = await Iota.reserveGas(gasStationConfig);

			const tx = new Transaction();
			tx.moveCall({
				target: "0x2::clock::timestamp_ms",
				arguments: [tx.object("0x6")]
			});

			tx.setSender(userAddress);
			tx.setGasOwner(gasReservation.sponsorAddress);
			tx.setGasPayment(gasReservation.gasCoins);
			tx.setGasBudget(GAS_BUDGET);

			const unsignedTxBytes = await tx.build({ client });

			const signer = new VaultSigner(vaultConnector, testSignerKeyName, testSignerPublicKey);
			const signature = await signer.signTransaction(unsignedTxBytes);

			const confirmedResponse = await Iota.executeAndConfirmGasStationTransaction(
				gasStationConfig,
				client,
				gasReservation.reservationId,
				unsignedTxBytes,
				signature.signature,
				{ waitForConfirmation: true }
			);

			expect(confirmedResponse).toBeDefined();
			expect(confirmedResponse.digest).toBeDefined();
			expect(typeof confirmedResponse.digest).toBe("string");
		});
	});
});
