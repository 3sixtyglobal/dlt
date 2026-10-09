// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError } from "@3sixty/core";
import { Bip39, Bip44, KeyType } from "@3sixty/crypto";
import { AccountHelper } from "@3sixty/dlt-account";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import {
	EntityStorageVaultConnector,
	initSchema,
	type VaultKey,
	type VaultSecret
} from "@3sixty/vault-connector-entity-storage";
import { VaultKeyType } from "@3sixty/vault-models";
import { Transaction } from "@iota/iota-sdk/transactions";
import {
	GAS_BUDGET,
	GAS_STATION_AUTH_TOKEN,
	GAS_STATION_URL,
	TEST_CLIENT_OPTIONS,
	TEST_IDENTITY,
	TEST_MNEMONIC,
	TEST_NETWORK
} from "./setupTestEnv.js";
import { Iota } from "../src/iota.js";
import type { IGasStationConfig } from "../src/models/IGasStationConfig.js";
import type { IIotaConfig } from "../src/models/IIotaConfig.js";
import { VaultSigner } from "../src/vaultSigner.js";

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
			`${TEST_IDENTITY}/${AccountHelper.DEFAULT_MNEMONIC_SECRET_NAME}`,
			TEST_MNEMONIC
		);

		const [userAddress] = await AccountHelper.getAddresses(
			gasStationConfig,
			vaultConnector,
			TEST_IDENTITY,
			0,
			0,
			1
		);
		const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
		const kp = Bip44.keyPair(seed, KeyType.Ed25519, AccountHelper.DEFAULT_COIN_TYPE, 0, false, 0);
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

			const [userAddress] = await AccountHelper.getAddresses(
				gasStationConfig,
				vaultConnector,
				TEST_IDENTITY,
				0,
				0,
				1,
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

			const [userAddress] = await AccountHelper.getAddresses(
				gasStationConfig,
				vaultConnector,
				TEST_IDENTITY,
				0,
				0,
				1
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

		test("Should post a transaction through prepareAndPostGasStationTransaction", async () => {
			// Drives the full sponsored path (reserve, rebuild, sign, execute) wrapped in the
			// object-reservation retry.
			await AccountHelper.createAccountKeys(
				gasStationConfig,
				vaultConnector,
				TEST_IDENTITY,
				TEST_MNEMONIC,
				0
			);
			const client = Iota.createClient(gasStationConfig);
			const [userAddress] = await AccountHelper.getAddresses(
				gasStationConfig,
				vaultConnector,
				TEST_IDENTITY,
				0,
				0,
				1
			);

			const tx = new Transaction();
			tx.moveCall({
				target: "0x2::clock::timestamp_ms",
				arguments: [tx.object("0x6")]
			});

			const response = await Iota.prepareAndPostGasStationTransaction(
				gasStationConfig,
				vaultConnector,
				TEST_IDENTITY,
				client,
				userAddress,
				tx
			);

			expect(response).toBeDefined();
			expect(typeof response.digest).toBe("string");
		});

		test("concurrent sponsored transactions each succeed or return the clear reservation error", async () => {
			// Fires concurrent sponsored transactions that all reference the SAME sender-owned coin
			// (sponsor gas coins are reserved disjointly per reservation, so a sender-owned input is
			// what makes them genuinely contend) and asserts the issue #90 contract: each either
			// succeeds, fails with the clear objectReservationConflict, or hits the documented
			// non-retryable equivocation case; never the opaque gasStationTransactionFailed for a
			// conflict. Success is NOT guaranteed under genuine contention (validator locks can
			// split so no transaction reaches quorum), so no minimum success count is asserted.
			await AccountHelper.createAccountKeys(
				gasStationConfig,
				vaultConnector,
				TEST_IDENTITY,
				TEST_MNEMONIC,
				0
			);
			const client = Iota.createClient(gasStationConfig);
			const [userAddress] = await AccountHelper.getAddresses(
				gasStationConfig,
				vaultConnector,
				TEST_IDENTITY,
				0,
				0,
				1
			);

			// Contend on the SMALLEST coin: heavy contention can leave validator locks on the coin
			// until the epoch changes, so deliberately keep the wallet's primary gas coin out of the
			// blast radius (locking a small coin is harmless, locking the primary coin breaks every
			// later test that needs gas). Best effort: split a small coin off first if there is none.
			let coins = await client.getCoins({ owner: userAddress });
			expect(coins.data.length).toBeGreaterThan(0);
			if (coins.data.length === 1) {
				try {
					const splitTx = new Transaction();
					const [part] = splitTx.splitCoins(splitTx.object(coins.data[0].coinObjectId), [
						splitTx.pure.u64(1000000000)
					]);
					splitTx.transferObjects([part], splitTx.pure.address(userAddress));
					await Iota.prepareAndPostGasStationTransaction(
						gasStationConfig,
						vaultConnector,
						TEST_IDENTITY,
						client,
						userAddress,
						splitTx
					);
					coins = await client.getCoins({ owner: userAddress });
				} catch {
					// The single coin may be temporarily locked; fall back to contending on it.
				}
			}
			const sortedCoins = [...coins.data].sort((a, b) =>
				Number(BigInt(a.balance) - BigInt(b.balance))
			);
			const sharedCoinId = sortedCoins[0].coinObjectId;

			const concurrency = 4;
			const results = await Promise.allSettled(
				Array.from({ length: concurrency }, async () => {
					const tx = new Transaction();
					tx.transferObjects([tx.object(sharedCoinId)], tx.pure.address(userAddress));
					return Iota.prepareAndPostGasStationTransaction(
						gasStationConfig,
						vaultConnector,
						TEST_IDENTITY,
						client,
						userAddress,
						tx
					);
				})
			);

			expect(results).toHaveLength(concurrency);
			for (const result of results) {
				if (result.status === "rejected") {
					const isClearConflict = BaseError.someErrorMessage(
						result.reason,
						/objectReservationConflict/
					);
					const isEquivocated = BaseError.someErrorMessage(
						result.reason,
						/equivocated until the next epoch/
					);
					expect(isClearConflict || isEquivocated).toBe(true);
				}
			}
		});

		test("Should report connectivity to a running gas station", async () => {
			const isHealthy = await Iota.checkGasStationConnectivity(gasStationConfig);
			expect(isHealthy).toBe(true);
		});

		test("Should complete a gas station health check via sponsored transaction", async () => {
			await expect(Iota.checkGasStationIsWorking(gasStationConfig)).resolves.toBeUndefined();
		});
	});
});
