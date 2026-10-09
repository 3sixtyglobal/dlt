// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BaseError,
	Coerce,
	Converter,
	GeneralError,
	Guards,
	Is,
	StringHelper,
	type IError
} from "@3sixty/core";
import { AccountHelper } from "@3sixty/dlt-account";
import type { ILoggingComponent } from "@3sixty/logging-models";
import { nameof } from "@3sixty/nameof";
import type { IVaultConnector } from "@3sixty/vault-models";
import { FetchHelper, HttpMethod } from "@3sixty/web";
import { IotaClient } from "@iota/iota-sdk/client";
import { requestIotaFromFaucetV0 } from "@iota/iota-sdk/faucet";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import type { IGasReservationResult } from "./models/IGasReservationResult.js";
import type { IGasStationConfig } from "./models/IGasStationConfig.js";
import type { IGasStationExecuteResponse } from "./models/IGasStationExecuteResponse.js";
import type { IGasStationParams } from "./models/IGasStationParams.js";
import type { IGasStationReserveGasResponse } from "./models/IGasStationReserveGasResponse.js";
import type { IIotaClient } from "./models/IIotaClient.js";
import type { IIotaConfig } from "./models/IIotaConfig.js";
import type { IIotaDryRun } from "./models/IIotaDryRun.js";
import type { IIotaResponseOptions } from "./models/IIotaResponseOptions.js";
import type { IIotaTransaction } from "./models/IIotaTransaction.js";
import type { IIotaTransactionBlockResponse } from "./models/IIotaTransactionBlockResponse.js";
import { VaultSigner } from "./vaultSigner.js";
import { VaultTransactionSigner } from "./vaultTransactionSigner.js";

/**
 * Class for performing operations on IOTA.
 */
export class Iota {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<Iota>();

	/**
	 * Default inclusion timeout.
	 * @internal
	 */
	private static readonly _DEFAULT_INCLUSION_TIMEOUT: number = 60;

	/**
	 * Default gas budget for all transactions (including sponsored and direct).
	 * @internal
	 */
	private static readonly _DEFAULT_GAS_BUDGET: number = 50000000;

	/**
	 * Default gas reservation duration.
	 * @internal
	 */
	private static readonly _DEFAULT_GAS_RESERVATION_DURATION: number = 60;

	/**
	 * Default number of retries when owned objects are reserved by another transaction.
	 * @internal
	 */
	private static readonly _DEFAULT_OBJECT_LOCK_RETRIES: number = 3;

	/**
	 * Default base delay in milliseconds between object-lock retries.
	 * @internal
	 */
	private static readonly _DEFAULT_OBJECT_LOCK_RETRY_DELAY_MS: number = 1000;

	/**
	 * Pattern that identifies the retryable "objects reserved by another transaction" node error.
	 * @internal
	 */
	private static readonly _RESERVED_OBJECT_ERROR_PATTERN: RegExp =
		/reserved for another transaction/;

	/**
	 * Pattern that identifies the node error for an owned-object version that was consumed by a
	 * concurrent transaction. Retryable since the retry rebuild re-resolves to the current version.
	 * @internal
	 */
	private static readonly _STALE_OBJECT_ERROR_PATTERN: RegExp = /is not available for consumption/;

	/**
	 * Pattern that identifies the gas station error returned when it cannot allocate gas because its
	 * coin pool is exhausted by concurrent sponsorships. Retryable: coins are reclaimed once the
	 * competing transactions confirm, so a subsequent attempt can usually succeed.
	 * @internal
	 */
	private static readonly _GAS_RESERVATION_ERROR_PATTERN: RegExp = /Unable to reserve gas coins/;

	/**
	 * Create a new IOTA client.
	 * @param config The configuration.
	 * @returns The client instance.
	 */
	public static createClient(config: IIotaConfig): IIotaClient {
		Guards.object(Iota.CLASS_NAME, nameof(config), config);
		Guards.object(Iota.CLASS_NAME, nameof(config.clientOptions), config.clientOptions);
		Guards.string(Iota.CLASS_NAME, nameof(config.clientOptions.url), config.clientOptions.url);

		return new IotaClient(config.clientOptions);
	}

	/**
	 * Create configuration using defaults where necessary.
	 * @param config The configuration to populate.
	 */
	public static populateConfig(config: IIotaConfig): void {
		Guards.object<IIotaConfig["clientOptions"]>(
			Iota.CLASS_NAME,
			nameof(config.clientOptions),
			config.clientOptions
		);

		config.vaultMnemonicId ??= AccountHelper.DEFAULT_MNEMONIC_SECRET_NAME;
		config.vaultSeedId ??= AccountHelper.DEFAULT_SEED_SECRET_NAME;
		config.coinType ??= AccountHelper.DEFAULT_COIN_TYPE;
		config.inclusionTimeoutSeconds ??= Iota._DEFAULT_INCLUSION_TIMEOUT;
	}

	/**
	 * Get a vault-backed transaction signer for the given identity and key indices.
	 * @param vaultConnector The vault connector.
	 * @param config The configuration.
	 * @param identity The identity of the user to access the vault keys.
	 * @param accountIndex The account index.
	 * @param addressIndex The address index within the account.
	 * @returns A VaultTransactionSigner for the specified key.
	 */
	public static async getTransactionSigner(
		vaultConnector: IVaultConnector,
		config: IIotaConfig,
		identity: string,
		accountIndex: number,
		addressIndex: number
	): Promise<VaultTransactionSigner> {
		Guards.object(Iota.CLASS_NAME, nameof(vaultConnector), vaultConnector);
		Guards.object<IIotaConfig>(Iota.CLASS_NAME, nameof(config), config);
		Guards.stringValue(Iota.CLASS_NAME, nameof(identity), identity);
		Guards.integer(Iota.CLASS_NAME, nameof(accountIndex), accountIndex);
		Guards.integer(Iota.CLASS_NAME, nameof(addressIndex), addressIndex);

		const publicKeys = await AccountHelper.getPublicKeys(
			config,
			vaultConnector,
			identity,
			accountIndex,
			false,
			addressIndex,
			async () => AccountHelper.getSeed(config, vaultConnector, identity)
		);

		const chunkStart = addressIndex - (addressIndex % AccountHelper.DEFAULT_CALC_CHUNK_SIZE);
		const offsetInChunk = addressIndex - chunkStart;
		const publicKey = Converter.base64ToBytes(publicKeys[offsetInChunk]);
		const keyName = AccountHelper.buildAddressKeyName(identity, accountIndex, false, addressIndex);

		return new VaultTransactionSigner(vaultConnector, keyName, publicKey);
	}

	/**
	 * Create a new transaction instance.
	 * @returns A new transaction instance.
	 */
	public static createTransaction(): IIotaTransaction {
		return new Transaction();
	}

	/**
	 * Prepare and post a transaction.
	 * @param config The configuration.
	 * @param vaultConnector The vault connector.
	 * @param logging The logging component.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client instance.
	 * @param source The source address.
	 * @param amount The amount to transfer.
	 * @param recipient The recipient address.
	 * @param options The transaction options.
	 * @returns The transaction result.
	 */
	public static async prepareAndPostValueTransaction(
		config: IIotaConfig,
		vaultConnector: IVaultConnector,
		logging: ILoggingComponent | undefined,
		identity: string,
		client: IIotaClient,
		source: string,
		amount: bigint,
		recipient: string,
		options?: IIotaResponseOptions
	): Promise<IIotaTransactionBlockResponse> {
		try {
			const txb = new Transaction();
			const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(amount)]);
			txb.transferObjects([coin], txb.pure.address(recipient));

			// Check if gas station configuration is present
			if (Is.object<IGasStationConfig>(config.gasStation)) {
				return await Iota.prepareAndPostGasStationTransaction(
					config,
					vaultConnector,
					identity,
					client,
					source,
					txb
				);
			}

			const result = await Iota.prepareAndPostTransaction(
				config,
				vaultConnector,
				logging,
				identity,
				client,
				source,
				txb,
				options
			);
			return result;
		} catch (error) {
			// Pass through the clear object-conflict error; wrap everything else as before.
			if (Iota.isRetryableObjectConflictError(error)) {
				throw error;
			}
			throw new GeneralError(
				Iota.CLASS_NAME,
				"valueTransactionFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Prepare and post a transaction.
	 * @param config The configuration.
	 * @param vaultConnector The vault connector.
	 * @param logging The logging component.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client instance.
	 * @param owner The owner of the address.
	 * @param transaction The transaction to execute.
	 * @param options The transaction options.
	 * @returns The transaction response.
	 */
	public static async prepareAndPostTransaction(
		config: IIotaConfig,
		vaultConnector: IVaultConnector,
		logging: ILoggingComponent | undefined,
		identity: string,
		client: IIotaClient,
		owner: string,
		transaction: IIotaTransaction,
		options?: IIotaResponseOptions
	): Promise<IIotaTransactionBlockResponse> {
		// Check if gas station configuration is present
		if (Is.object<IGasStationConfig>(config.gasStation)) {
			return Iota.prepareAndPostGasStationTransaction(
				config,
				vaultConnector,
				identity,
				client,
				owner,
				transaction,
				options
			);
		}

		// Traditional transaction flow
		// Capture the transaction while its inputs are still unresolved. The SDK pins owned-object
		// versions and gas payment on the first build, so a single built transaction would resubmit
		// byte-identical bytes on every retry. Cloning this template per attempt lets object
		// versions and gas re-resolve, which is what allows a retry to actually recover once the
		// conflicting transaction clears.
		const template = Transaction.from(transaction);

		// Dry run the transaction if cost logging is enabled to get the gas and storage costs
		if (Is.stringValue(options?.dryRunLabel)) {
			await Iota.dryRunTransaction(client, logging, transaction, owner, options.dryRunLabel);
		}

		const { keyName, publicKey } = await AccountHelper.findAddressKey(
			config,
			vaultConnector,
			identity,
			owner
		);
		const signer = new VaultSigner(vaultConnector, keyName, publicKey);

		try {
			// Concurrent transactions that reference the same owned objects can be rejected while
			// those objects are reserved for another in-flight transaction, so retry the submission
			// with back-off until the reservation clears. Each attempt rebuilds from the unresolved
			// template so versions and gas re-resolve rather than resubmitting identical bytes.
			return await Iota.executeWithReservationRetry(config, async () => {
				const response = await client.signAndExecuteTransaction({
					transaction: Transaction.from(template),
					signer,
					requestType: "WaitForLocalExecution",
					options: {
						showEffects: options?.showEffects ?? true,
						showEvents: options?.showEvents ?? true,
						showObjectChanges: options?.showObjectChanges ?? true
					}
				});

				if (options?.waitForConfirmation ?? true) {
					// Wait for transaction to be indexed and available over API
					return Iota.waitForTransactionConfirmation(client, response.digest, config, {
						showEffects: options?.showEffects ?? true,
						showEvents: options?.showEvents ?? true,
						showObjectChanges: options?.showObjectChanges ?? true
					});
				}

				return response;
			});
		} catch (error) {
			// Pass through the clear object-conflict error; wrap everything else (including any
			// non-conflict GeneralError raised inside, e.g. a vault signing failure) as before.
			if (Iota.isRetryableObjectConflictError(error)) {
				throw error;
			}
			throw new GeneralError(
				Iota.CLASS_NAME,
				"transactionFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Extract error from SDK payload.
	 * Errors from the IOTA SDK are usually not JSON strings but objects.
	 * @param error The error to extract.
	 * @returns The extracted error.
	 */
	public static extractPayloadError(error: unknown): IError {
		if (Is.object<{ code?: string; message?: string; inner?: unknown; cause?: unknown }>(error)) {
			if (!Is.empty(error.inner)) {
				error.inner = Iota.extractPayloadError(error.inner);
			}
			if (!Is.empty(error.cause)) {
				error.cause = Iota.extractPayloadError(error.cause);
			}

			if (error.code === "InsufficientGas") {
				return new GeneralError(Iota.CLASS_NAME, "insufficientFunds");
			} else if (error.message?.startsWith("ErrorObject")) {
				const msg = /message: "(.*)"/.exec(error.message);
				if (msg && msg.length > 1) {
					error = msg[1];
				}
			}
		}

		const baseError = BaseError.fromError(error);
		if (baseError.name === "Base" && !Is.stringValue(baseError.source)) {
			baseError.name = "IOTA";
			baseError.source = Iota.CLASS_NAME;
		}
		return baseError;
	}

	/**
	 * Check if the package exists on the network.
	 * @param client The client to use.
	 * @param packageId The package ID to check.
	 * @returns True if the package exists, false otherwise.
	 */
	public static async packageExistsOnNetwork(
		client: IIotaClient,
		packageId: string
	): Promise<boolean> {
		try {
			const packageObject = await client.getObject({
				id: packageId,
				options: {
					showType: true
				}
			});

			if ("error" in packageObject) {
				if (packageObject?.error?.code === "notExists") {
					return false;
				}
				throw new GeneralError(Iota.CLASS_NAME, "packageObjectError", {
					packageId,
					error: packageObject.error
				});
			}

			return true;
		} catch (error) {
			throw new GeneralError(
				Iota.CLASS_NAME,
				"packageNotFoundOnNetwork",
				{
					packageId
				},
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Dry run a transaction and log the results.
	 * @param client The IOTA client.
	 * @param logging The logging component.
	 * @param txb The transaction to dry run.
	 * @param sender The sender address.
	 * @param operation The operation to log.
	 * @returns The dry run result including status, costs, events, and object changes.
	 */
	public static async dryRunTransaction(
		client: IIotaClient,
		logging: ILoggingComponent | undefined,
		txb: IIotaTransaction,
		sender: string,
		operation: string
	): Promise<IIotaDryRun> {
		try {
			txb.setSender(sender);

			const builtTx = await txb.build({
				client,
				onlyTransactionKind: false
			});

			const dryRunResult = await client.dryRunTransactionBlock({
				transactionBlock: builtTx
			});

			if (dryRunResult.effects.status?.status !== "success") {
				throw new GeneralError(Iota.CLASS_NAME, "dryRunFailed", {
					error: dryRunResult.effects?.status?.error
				});
			}

			const result = {
				status: dryRunResult.effects.status.status,
				costs: {
					computationCost: dryRunResult.effects.gasUsed.computationCost,
					computationCostBurned: dryRunResult.effects.gasUsed.computationCostBurned,
					storageCost: dryRunResult.effects.gasUsed.storageCost,
					storageRebate: dryRunResult.effects.gasUsed.storageRebate,
					nonRefundableStorageFee: dryRunResult.effects.gasUsed.nonRefundableStorageFee
				},
				events: dryRunResult.events ?? [],
				balanceChanges: dryRunResult.balanceChanges ?? [],
				objectChanges: dryRunResult.objectChanges ?? []
			};

			await logging?.log({
				level: "info",
				source: Iota.CLASS_NAME,
				ts: Date.now(),
				message: "transactionCosts",
				data: {
					operation,
					cost: JSON.stringify(result)
				}
			});

			return result;
		} catch (error) {
			if (BaseError.isErrorName(error, GeneralError.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				Iota.CLASS_NAME,
				"dryRunFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Wait for a transaction to be indexed and available over the API.
	 * @param client The IOTA client instance.
	 * @param digest The digest of the transaction to wait for.
	 * @param config The IOTA configuration.
	 * @param options Additional options for the transaction query.
	 * @param options.showEffects Whether to show effects.
	 * @param options.showEvents Whether to show events.
	 * @param options.showObjectChanges Whether to show object changes.
	 * @returns The confirmed transaction response.
	 */
	public static async waitForTransactionConfirmation(
		client: IIotaClient,
		digest: string,
		config: IIotaConfig,
		options?: {
			showEffects?: boolean;
			showEvents?: boolean;
			showObjectChanges?: boolean;
		}
	): Promise<IIotaTransactionBlockResponse> {
		const timeoutMs = (config.inclusionTimeoutSeconds ?? Iota._DEFAULT_INCLUSION_TIMEOUT) * 1000;

		return client.waitForTransaction({
			digest,
			timeout: timeoutMs,
			options: {
				showEffects: options?.showEffects ?? true,
				showEvents: options?.showEvents ?? true,
				showObjectChanges: options?.showObjectChanges ?? true
			}
		});
	}

	/**
	 * Check if the error is an abort error with a specific code.
	 * @param error The error to check.
	 * @param code The error code to check for.
	 * @returns True if the error is an abort error, false otherwise.
	 */
	public static isAbortError(error: unknown, code: number): boolean {
		const err = BaseError.fromError(error);
		if (Is.stringValue(err.properties?.error)) {
			const abortCodeMatch = /abort code\s*:\s*(\d+)/i.exec(err.properties.error);
			return abortCodeMatch?.[1] === code.toString();
		}
		return false;
	}

	/**
	 * Extracts the abort code from a transaction result if the transaction was aborted.
	 * @param response The transaction result to extract the abort code from.
	 * @returns The abort code if the transaction was aborted, or undefined if it was not an abort error or the code could not be extracted.
	 */
	public static extractAbortCode(response: IIotaTransactionBlockResponse): number | undefined {
		if (
			response.effects?.status?.status === "failure" &&
			Is.stringValue(response.effects.status.error)
		) {
			const match = /abort code: (\d+)/.exec(response.effects.status.error);
			if (match) {
				return Coerce.integer(match[1]);
			}
		}
	}

	/**
	 * Check if an error is a retryable "owned object reserved by another transaction" conflict.
	 * IOTA locks owned objects for the first in-flight transaction that claims them, so a
	 * concurrent transaction referencing the same objects is rejected until the lock clears. This
	 * only matches the transient "reserved for another transaction" case, not the non-retryable
	 * "equivocated until the next epoch" case.
	 * @param error The error to check.
	 * @returns True if the error is a retryable object reservation conflict.
	 */
	public static isReservedObjectError(error: unknown): boolean {
		return Is.stringValue(Iota.objectConflictMessage(error, Iota._RESERVED_OBJECT_ERROR_PATTERN));
	}

	/**
	 * Check if an error is a retryable owned-object conflict caused by a concurrent transaction.
	 * This covers both the "reserved for another transaction" case (the object is locked by an
	 * in-flight transaction) and the "is not available for consumption" case (a concurrent
	 * transaction already consumed the referenced version); a retry rebuild re-resolves to the
	 * current version so both can recover. The non-retryable "equivocated until the next epoch"
	 * case is not matched.
	 * @param error The error to check.
	 * @returns True if the error is a retryable owned-object conflict.
	 */
	public static isRetryableObjectConflictError(error: unknown): boolean {
		return (
			Is.stringValue(Iota.objectConflictMessage(error, Iota._RESERVED_OBJECT_ERROR_PATTERN)) ||
			Is.stringValue(Iota.objectConflictMessage(error, Iota._STALE_OBJECT_ERROR_PATTERN)) ||
			Is.stringValue(Iota.objectConflictMessage(error, Iota._GAS_RESERVATION_ERROR_PATTERN))
		);
	}

	/**
	 * Extract the conflicting transaction digests from an object reservation conflict error.
	 * The node error lists the digests of the transactions currently locking the objects (the
	 * underlying object ids are only present in the RPC error data, which the IOTA SDK discards).
	 * Only the "reserved for another transaction" error carries digests, so this returns an empty
	 * array for the stale-version conflict case.
	 * @param error The error to extract from.
	 * @returns The conflicting transaction digests, or an empty array if none can be parsed.
	 */
	public static extractReservationConflictDigests(error: unknown): string[] {
		const message = Iota.objectConflictMessage(error, Iota._RESERVED_OBJECT_ERROR_PATTERN);
		if (!Is.stringValue(message)) {
			return [];
		}

		const digests: string[] = [];
		// The direct path preserves real newlines; through the gas station the node message is
		// Debug-formatted so the newlines arrive as the literal two-character sequence "\n", hence
		// both a real newline and an escaped one are treated as a line start here.
		const linePattern = /(?:^|\n|\\n)- (\S+) \(stake /g;
		let match = linePattern.exec(message);
		while (match !== null) {
			digests.push(match[1]);
			match = linePattern.exec(message);
		}
		return digests;
	}

	/**
	 * Run a transaction submission operation, retrying with exponential back-off if it is rejected
	 * because of a retryable owned-object conflict with a concurrent transaction (the objects are
	 * reserved by an in-flight transaction, or the referenced version was already consumed).
	 * Other errors are rethrown immediately. If the conflict persists after all retries a clear,
	 * retryable error is thrown instead of the opaque underlying failure.
	 * @param config The configuration controlling retry counts and delays.
	 * @param operation The transaction submission operation to run.
	 * @returns The result of the operation.
	 */
	public static async executeWithReservationRetry<T>(
		config: IIotaConfig,
		operation: () => Promise<T>
	): Promise<T> {
		if (!Is.undefined(config.objectLockRetries)) {
			Guards.integer(Iota.CLASS_NAME, nameof(config.objectLockRetries), config.objectLockRetries);
		}
		if (!Is.undefined(config.objectLockRetryDelayMs)) {
			Guards.integer(
				Iota.CLASS_NAME,
				nameof(config.objectLockRetryDelayMs),
				config.objectLockRetryDelayMs
			);
		}
		const maxRetries = Math.max(0, config.objectLockRetries ?? Iota._DEFAULT_OBJECT_LOCK_RETRIES);
		const baseDelayMs = Math.max(
			0,
			config.objectLockRetryDelayMs ?? Iota._DEFAULT_OBJECT_LOCK_RETRY_DELAY_MS
		);

		let lastError: unknown;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				if (!Iota.isRetryableObjectConflictError(error)) {
					// If we already saw at least one retryable conflict on a prior attempt, a
					// subsequent non-retryable error (e.g. "object not found" because the winner
					// consumed the coin) still belongs to the conflict scenario - break so we fall
					// through to the objectReservationConflict throw rather than surfacing this
					// secondary error directly.
					if (lastError !== undefined) {
						break;
					}
					throw error;
				}
				lastError = error;
				if (attempt < maxRetries) {
					// Exponential back-off with jitter: concurrent losers fail at nearly the same moment,
					// so without jitter they would resubmit in lockstep and re-race each other each round.
					const jitter = (1 + Math.random()) / 2;
					const delayMs = baseDelayMs * Math.pow(2, attempt) * jitter;
					await new Promise(resolve => setTimeout(resolve, delayMs));
				}
			}
		}

		throw new GeneralError(
			Iota.CLASS_NAME,
			"objectReservationConflict",
			{ conflictingTransactions: Iota.extractReservationConflictDigests(lastError) },
			Iota.extractPayloadError(lastError)
		);
	}

	/**
	 * Prepare and post a transaction using gas station sponsoring.
	 * @param config The configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client instance.
	 * @param owner The owner of the address.
	 * @param transaction The transaction to execute.
	 * @param options Response options including confirmation behavior.
	 * @returns The transaction response.
	 */
	public static async prepareAndPostGasStationTransaction(
		config: IIotaConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: IIotaClient,
		owner: string,
		transaction: IIotaTransaction,
		options?: IIotaResponseOptions
	): Promise<IIotaTransactionBlockResponse> {
		const gasStationParams = Iota.buildGasStationParams(config);

		// Capture the transaction while its inputs are still unresolved so each retry attempt can
		// rebuild with fresh object versions (see prepareAndPostTransaction).
		const template = Transaction.from(transaction);

		const { keyName, publicKey } = await AccountHelper.findAddressKey(
			config,
			vaultConnector,
			identity,
			owner
		);
		const signer = new VaultSigner(vaultConnector, keyName, publicKey);

		try {
			// Sponsored transactions still reference the sender's owned objects, so the same
			// reservation conflict can occur. Retry with a fresh gas reservation and a rebuilt
			// transaction on each attempt (the reserved sponsor coins and object versions change).
			return await Iota.executeWithReservationRetry(config, async () => {
				const gasReservation = await Iota.reserveGas(config);

				// Rebuild and set the sponsoring parameters for this attempt.
				const attemptTransaction = Transaction.from(template);
				attemptTransaction.setSender(owner);
				attemptTransaction.setGasOwner(gasReservation.sponsorAddress);
				attemptTransaction.setGasPayment(gasReservation.gasCoins);
				attemptTransaction.setGasBudget(gasStationParams.gasBudget);

				const unsignedTxBytes = await attemptTransaction.build({ client });
				const signature = await signer.signTransaction(unsignedTxBytes);

				return Iota.executeAndConfirmGasStationTransaction(
					config,
					client,
					gasReservation.reservationId,
					unsignedTxBytes,
					signature.signature,
					options
				);
			});
		} catch (error) {
			// Pass through retryable conflict errors and any GeneralError already raised by our
			// own code (e.g. objectReservationConflict from the retry loop); wrap raw SDK or
			// network errors as the opaque gasStationTransactionFailed.
			if (
				Iota.isRetryableObjectConflictError(error) ||
				BaseError.isErrorName(error, GeneralError.CLASS_NAME)
			) {
				throw error;
			}
			throw Iota.wrapGasStationError(error);
		}
	}

	/**
	 * Check whether gas station mode is fully configured.
	 * @param config The configuration to check.
	 * @returns True if both the gas station url and auth token are set.
	 */
	public static isGasStationEnabled(config: IIotaConfig): boolean {
		return (
			Is.stringValue(config.gasStation?.gasStationUrl) &&
			Is.stringValue(config.gasStation?.gasStationAuthToken)
		);
	}

	/**
	 * Check whether the gas station HTTP endpoint is reachable and responding.
	 * @param config The configuration containing gas station settings.
	 * @returns True if the gas station responds with "OK", false otherwise.
	 */
	public static async checkGasStationConnectivity(config: IIotaConfig): Promise<boolean> {
		Guards.object<IGasStationConfig>(Iota.CLASS_NAME, nameof(config.gasStation), config.gasStation);
		Guards.stringValue(
			Iota.CLASS_NAME,
			nameof(config.gasStation.gasStationUrl),
			config.gasStation.gasStationUrl
		);

		const url = StringHelper.trimTrailingSlashes(config.gasStation.gasStationUrl);

		try {
			const response = await FetchHelper.fetch(Iota.CLASS_NAME, url, HttpMethod.GET);
			const body = await response.text();
			return response.ok && body.trim() === "OK";
		} catch {
			return false;
		}
	}

	/**
	 * Verify the gas station is fully operational by executing a sponsored transaction
	 * end-to-end (reserve gas → sign → execute → confirm).
	 *
	 * A read-only Move clock call is used as the test payload so that no objects are created
	 * and no on-chain state is left behind.
	 * @param config The configuration containing gas station settings and client options.
	 */
	public static async checkGasStationIsWorking(config: IIotaConfig): Promise<void> {
		Guards.object<IGasStationConfig>(Iota.CLASS_NAME, nameof(config.gasStation), config.gasStation);

		const client = Iota.createClient(config);
		const gasStationParams = Iota.buildGasStationParams(config);
		const keypair = Ed25519Keypair.generate();
		const sender = keypair.toIotaAddress();

		try {
			const reservation = await Iota.reserveGas(config);

			const tx = new Transaction();
			tx.setSender(sender);
			tx.setGasOwner(reservation.sponsorAddress);
			tx.setGasPayment(reservation.gasCoins);
			tx.setGasBudget(gasStationParams.gasBudget);
			tx.moveCall({
				target: "0x2::clock::timestamp_ms",
				arguments: [tx.object("0x6")]
			});

			const txBytes = await tx.build({ client });
			const sig = await keypair.signTransaction(txBytes);
			await Iota.executeAndConfirmGasStationTransaction(
				config,
				client,
				reservation.reservationId,
				txBytes,
				sig.signature
			);
		} catch (error) {
			if (BaseError.isErrorName(error, GeneralError.CLASS_NAME)) {
				throw error;
			}
			throw Iota.wrapGasStationError(error);
		}
	}

	/**
	 * Build the resolved gas station parameters, applying the same defaults as gas reservation.
	 * @param config The configuration containing gas station settings.
	 * @returns The resolved gas station parameters.
	 */
	public static buildGasStationParams(config: IIotaConfig): IGasStationParams {
		Guards.object<IGasStationConfig>(Iota.CLASS_NAME, nameof(config.gasStation), config.gasStation);

		return {
			gasStationUrl: StringHelper.trimTrailingSlashes(config.gasStation.gasStationUrl),
			gasStationAuthToken: config.gasStation.gasStationAuthToken,
			gasBudget: config.gasBudget ?? Iota._DEFAULT_GAS_BUDGET,
			gasReservationDuration:
				config.gasReservationDuration ?? Iota._DEFAULT_GAS_RESERVATION_DURATION
		};
	}

	/**
	 * Wrap a failure from a gas station sponsored path in the standard error.
	 * @param error The error from the sponsored execution.
	 * @returns The wrapped error.
	 */
	public static wrapGasStationError(error: unknown): GeneralError {
		return new GeneralError(
			Iota.CLASS_NAME,
			"gasStationTransactionFailed",
			undefined,
			Iota.extractPayloadError(error)
		);
	}

	/**
	 * Reserve gas from the gas station.
	 * @param config The configuration containing gas station settings.
	 * @returns The gas reservation result.
	 */
	public static async reserveGas(config: IIotaConfig): Promise<IGasReservationResult> {
		const gasStationParams = Iota.buildGasStationParams(config);

		const requestData = {
			// eslint-disable-next-line camelcase
			gas_budget: gasStationParams.gasBudget,
			// eslint-disable-next-line camelcase
			reserve_duration_secs: gasStationParams.gasReservationDuration
		};

		const result = await FetchHelper.fetchJson<typeof requestData, IGasStationReserveGasResponse>(
			Iota.CLASS_NAME,
			`${gasStationParams.gasStationUrl}/v1/reserve_gas`,
			HttpMethod.POST,
			requestData,
			{
				headers: {
					Authorization: `Bearer ${gasStationParams.gasStationAuthToken}`
				}
			}
		);

		const apiResponse = result.result;

		return {
			sponsorAddress: apiResponse.sponsor_address,
			reservationId: apiResponse.reservation_id,
			gasCoins: apiResponse.gas_coins
		};
	}

	/**
	 * Execute a sponsored transaction through the gas station.
	 * @param config The configuration containing gas station settings.
	 * @param reservationId The reservation ID from gas reservation.
	 * @param transactionBytes The unsigned transaction bytes.
	 * @param userSignature The user's signature.
	 * @returns The transaction response.
	 */
	public static async executeGasStationTransaction(
		config: IIotaConfig,
		reservationId: number,
		transactionBytes: Uint8Array,
		userSignature: string
	): Promise<IIotaTransactionBlockResponse> {
		Guards.object<IGasStationConfig>(Iota.CLASS_NAME, nameof(config.gasStation), config.gasStation);

		const requestData = {
			// eslint-disable-next-line camelcase
			reservation_id: reservationId,
			// eslint-disable-next-line camelcase
			tx_bytes: Converter.bytesToBase64(transactionBytes),
			// eslint-disable-next-line camelcase
			user_sig: userSignature
		};

		const baseUrl = StringHelper.trimTrailingSlashes(config.gasStation.gasStationUrl);
		const result = await FetchHelper.fetchJson<typeof requestData, IGasStationExecuteResponse>(
			Iota.CLASS_NAME,
			`${baseUrl}/v1/execute_tx`,
			HttpMethod.POST,
			requestData,
			{
				headers: {
					Authorization: `Bearer ${config.gasStation.gasStationAuthToken}`
				}
			}
		);

		if (Is.stringValue(result.error)) {
			throw new GeneralError(Iota.CLASS_NAME, "gasStationTransactionFailed", undefined, {
				name: "Error",
				message: result.error
			});
		}

		const effectsData = result.effects;

		// Match IotaTransactionBlockResponse format
		return {
			digest: effectsData.transactionDigest,
			effects: effectsData as unknown,
			events: [],
			objectChanges: [],
			confirmedLocalExecution: true
		} as unknown as IIotaTransactionBlockResponse;
	}

	/**
	 * Execute and confirm a gas station transaction.
	 * @param config The configuration containing gas station settings.
	 * @param client The IOTA client for confirmation.
	 * @param reservationId The reservation ID from gas reservation.
	 * @param transactionBytes The unsigned transaction bytes.
	 * @param userSignature The user's signature.
	 * @param options Response options including confirmation behavior.
	 * @returns The transaction response (confirmed if waitForConfirmation is true).
	 */
	public static async executeAndConfirmGasStationTransaction(
		config: IIotaConfig,
		client: IIotaClient,
		reservationId: number,
		transactionBytes: Uint8Array,
		userSignature: string,
		options?: IIotaResponseOptions
	): Promise<IIotaTransactionBlockResponse> {
		Guards.object<IGasStationConfig>(Iota.CLASS_NAME, nameof(config.gasStation), config.gasStation);

		const response = await Iota.executeGasStationTransaction(
			config,
			reservationId,
			transactionBytes,
			userSignature
		);

		if (options?.waitForConfirmation ?? true) {
			const confirmedTransaction = await Iota.waitForTransactionConfirmation(
				client,
				response.digest,
				config,
				{
					showEffects: options?.showEffects ?? true,
					showEvents: options?.showEvents ?? true,
					showObjectChanges: options?.showObjectChanges ?? true
				}
			);

			return confirmedTransaction;
		}

		return response;
	}

	/**
	 * Fund an address with IOTA from the faucet.
	 * @param config The configuration containing endpoint information.
	 * @param faucetUrl The URL of the faucet to request funds from.
	 * @param identity The identity of the user to access the vault keys.
	 * @param address The address to fund.
	 * @param timeoutInSeconds The timeout in seconds to wait for the funding to complete.
	 * @returns The amount funded.
	 */
	public static async fundAddress(
		config: IIotaConfig,
		faucetUrl: string,
		identity: string,
		address: string,
		timeoutInSeconds: number = 60
	): Promise<bigint> {
		Guards.objectValue<IIotaConfig>(Iota.CLASS_NAME, nameof(config), config);
		Guards.stringValue(Iota.CLASS_NAME, nameof(config.clientOptions.url), config.clientOptions.url);
		Guards.stringValue(Iota.CLASS_NAME, nameof(faucetUrl), faucetUrl);
		Guards.stringValue(Iota.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(Iota.CLASS_NAME, nameof(address), address);

		try {
			const initialBalance = await Iota.getBalance(config, address);

			const response = await requestIotaFromFaucetV0({
				host: faucetUrl,
				recipient: address
			});

			if (response?.error) {
				throw new GeneralError(Iota.CLASS_NAME, "fundingFailed", undefined, response.error);
			}

			// Poll for balance change
			const numTries = Math.ceil(timeoutInSeconds / 5);
			for (let i = 0; i < numTries; i++) {
				const newBalance = await Iota.getBalance(config, address);

				if (newBalance > initialBalance) {
					return newBalance - initialBalance;
				}

				if (i < numTries - 1) {
					await new Promise(resolve => setTimeout(resolve, 5000));
				}
			}
		} catch (error) {
			const payloadError = Iota.extractPayloadError(error);
			if (
				payloadError.message.includes(
					"Too many requests from this client have been sent to the faucet"
				)
			) {
				throw new GeneralError(
					Iota.CLASS_NAME,
					"faucetRateLimit",
					undefined,
					Iota.extractPayloadError(error)
				);
			}
			throw new GeneralError(
				Iota.CLASS_NAME,
				"fundingFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}

		return 0n;
	}

	/**
	 * Ensure the balance for the given address is at least the given amount.
	 * @param config The configuration containing endpoint information.
	 * @param faucetUrl The URL of the faucet to request funds from.
	 * @param identity The identity of the user to access the vault keys.
	 * @param address The address to ensure the balance for.
	 * @param ensureBalance The minimum balance to ensure.
	 * @param timeoutInSeconds Optional timeout in seconds, defaults to 10 seconds.
	 * @returns True if the balance is at least the given amount, false otherwise.
	 */
	public static async ensureBalance(
		config: IIotaConfig,
		faucetUrl: string | undefined,
		identity: string,
		address: string,
		ensureBalance: bigint,
		timeoutInSeconds?: number
	): Promise<boolean> {
		Guards.objectValue<IIotaConfig>(Iota.CLASS_NAME, nameof(config), config);
		Guards.stringValue(Iota.CLASS_NAME, nameof(config.clientOptions.url), config.clientOptions.url);
		Guards.stringValue(Iota.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(Iota.CLASS_NAME, nameof(address), address);
		Guards.bigint(Iota.CLASS_NAME, nameof(ensureBalance), ensureBalance);

		let currentBalance = await Iota.getBalance(config, address);

		if (Is.stringValue(faucetUrl)) {
			let retryCount = 10;

			while (currentBalance < ensureBalance && retryCount > 0) {
				const addedBalance = await Iota.fundAddress(
					config,
					faucetUrl,
					identity,
					address,
					timeoutInSeconds
				);
				if (addedBalance === 0n) {
					return false;
				}
				currentBalance += addedBalance;
				if (currentBalance < ensureBalance) {
					await new Promise(resolve => setTimeout(resolve, 1000));
					retryCount--;
				}
			}
		}

		return currentBalance >= ensureBalance;
	}

	/**
	 * Get the balance for the given address.
	 * @param config The configuration containing endpoint information.
	 * @param address The address to get the balance for.
	 * @returns The balance of the given address.
	 */
	public static async getBalance(config: IIotaConfig, address: string): Promise<bigint> {
		Guards.objectValue<IIotaConfig>(Iota.CLASS_NAME, nameof(config), config);
		Guards.stringValue(Iota.CLASS_NAME, nameof(config.clientOptions.url), config.clientOptions.url);
		Guards.stringValue(Iota.CLASS_NAME, nameof(address), address);

		const client = Iota.createClient(config);
		const balance = await client.getBalance({
			owner: address
		});
		return BigInt(balance.totalBalance);
	}

	/**
	 * Create a transaction instance from the given bytes.
	 * @param bytes The transaction bytes to create the transaction from.
	 * @returns The transaction instance created from the given bytes.
	 */
	public static transactionFromBytes(bytes: Uint8Array): IIotaTransaction {
		return Transaction.from(bytes);
	}

	/**
	 * Find the raw node message matching an object conflict pattern, wherever it surfaces. On the
	 * direct submission path it is the thrown error's message; through the gas station it arrives as
	 * an HTTP error whose body the fetch layer nests as the message of a cause error. Flattening the
	 * error tree and matching each message covers both.
	 * @param error The error to inspect.
	 * @param pattern The conflict pattern to match.
	 * @returns The raw node message if the pattern matches, otherwise undefined.
	 * @internal
	 */
	private static objectConflictMessage(error: unknown, pattern: RegExp): string | undefined {
		const match = BaseError.flatten(error).find(
			flattened => Is.stringValue(flattened.message) && pattern.test(flattened.message)
		);
		return match?.message;
	}
}
