# Class: Iota

Class for performing operations on IOTA.

## Constructors

### Constructor

> **new Iota**(): `Iota`

#### Returns

`Iota`

## Properties

### DEFAULT\_MNEMONIC\_SECRET\_NAME {#default_mnemonic_secret_name}

> `readonly` `static` **DEFAULT\_MNEMONIC\_SECRET\_NAME**: `string` = `"mnemonic"`

Default name for the mnemonic secret.

***

### DEFAULT\_SEED\_SECRET\_NAME {#default_seed_secret_name}

> `readonly` `static` **DEFAULT\_SEED\_SECRET\_NAME**: `string` = `"seed"`

Default name for the seed secret.

***

### DEFAULT\_COIN\_TYPE {#default_coin_type}

> `readonly` `static` **DEFAULT\_COIN\_TYPE**: `number` = `4218`

Default coin type.

***

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### createClient() {#createclient}

> `static` **createClient**(`config`): `IotaClient`

Create a new IOTA client.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration.

#### Returns

`IotaClient`

The client instance.

***

### populateConfig() {#populateconfig}

> `static` **populateConfig**(`config`): `void`

Create configuration using defaults where necessary.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration to populate.

#### Returns

`void`

***

### storeMnemonic() {#storemnemonic}

> `static` **storeMnemonic**(`vaultConnector`, `config`, `identity`, `mnemonic`, `accountIndex`): `Promise`\<`string`\>

Store a mnemonic in the vault, derive and store the seed, and pre-cache the first keypair chunk.

#### Parameters

##### vaultConnector

`IVaultConnector`

The vault connector.

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration.

##### identity

`string`

The identity of the user to access the vault keys.

##### mnemonic

`string` \| `undefined`

The mnemonic to store, if undefined a new one will be generated and returned.

##### accountIndex

`number`

The account index to pre-cache.

#### Returns

`Promise`\<`string`\>

The mnemonic that was stored.

***

### publicKeyToAddress() {#publickeytoaddress}

> `static` **publicKeyToAddress**(`publicKey`): `string`

Derive an address from a public key.

#### Parameters

##### publicKey

`Uint8Array`

The public key to derive the address from.

#### Returns

`string`

The derived address.

***

### getAddress() {#getaddress}

> `static` **getAddress**(`vaultConnector`, `config`, `identity`, `accountIndex`, `startAddressIndex`, `isInternal?`): `Promise`\<`string`\>

Get address for the identity.

#### Parameters

##### vaultConnector

`IVaultConnector`

The vault connector.

##### config

`Pick`\<[`IIotaConfig`](../interfaces/IIotaConfig.md), `"coinType"` \| `"vaultMnemonicId"` \| `"vaultSeedId"`\>

The configuration.

##### identity

`string`

The identity of the user to access the vault keys.

##### accountIndex

`number`

The account index to get the addresses for.

##### startAddressIndex

`number`

The start index for the addresses.

##### isInternal?

`boolean`

Whether the addresses are internal.

#### Returns

`Promise`\<`string`\>

The address.

***

### getAddresses() {#getaddresses}

> `static` **getAddresses**(`vaultConnector`, `config`, `identity`, `accountIndex`, `startAddressIndex`, `count`, `isInternal?`): `Promise`\<`string`[]\>

Get addresses for the identity.

#### Parameters

##### vaultConnector

`IVaultConnector`

The vault connector.

##### config

`Pick`\<[`IIotaConfig`](../interfaces/IIotaConfig.md), `"coinType"` \| `"vaultMnemonicId"` \| `"vaultSeedId"`\>

The configuration.

##### identity

`string`

The identity of the user to access the vault keys.

##### accountIndex

`number`

The account index to get the addresses for.

##### startAddressIndex

`number`

The start index for the addresses.

##### count

`number`

The number of addresses to generate.

##### isInternal?

`boolean`

Whether the addresses are internal.

#### Returns

`Promise`\<`string`[]\>

The list of addresses.

***

### getTransactionSigner() {#gettransactionsigner}

> `static` **getTransactionSigner**(`vaultConnector`, `config`, `identity`, `accountIndex`, `addressIndex`): `Promise`\<[`VaultTransactionSigner`](VaultTransactionSigner.md)\>

Get a vault-backed transaction signer for the given identity and key indices.

#### Parameters

##### vaultConnector

`IVaultConnector`

The vault connector.

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration.

##### identity

`string`

The identity of the user to access the vault keys.

##### accountIndex

`number`

The account index.

##### addressIndex

`number`

The address index within the account.

#### Returns

`Promise`\<[`VaultTransactionSigner`](VaultTransactionSigner.md)\>

A VaultTransactionSigner for the specified key.

***

### createTransaction() {#createtransaction}

> `static` **createTransaction**(): `Transaction`

Create a new transaction instance.

#### Returns

`Transaction`

A new transaction instance.

***

### prepareAndPostValueTransaction() {#prepareandpostvaluetransaction}

> `static` **prepareAndPostValueTransaction**(`config`, `vaultConnector`, `logging`, `identity`, `client`, `source`, `amount`, `recipient`, `options?`): `Promise`\<`IotaTransactionBlockResponse`\>

Prepare and post a transaction.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

##### logging

`ILoggingComponent` \| `undefined`

The logging component.

##### identity

`string`

The identity of the user to access the vault keys.

##### client

`IotaClient`

The client instance.

##### source

`string`

The source address.

##### amount

`bigint`

The amount to transfer.

##### recipient

`string`

The recipient address.

##### options?

[`IIotaResponseOptions`](../interfaces/IIotaResponseOptions.md)

The transaction options.

#### Returns

`Promise`\<`IotaTransactionBlockResponse`\>

The transaction result.

***

### prepareAndPostTransaction() {#prepareandposttransaction}

> `static` **prepareAndPostTransaction**(`config`, `vaultConnector`, `logging`, `identity`, `client`, `owner`, `transaction`, `options?`): `Promise`\<`IotaTransactionBlockResponse`\>

Prepare and post a transaction.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

##### logging

`ILoggingComponent` \| `undefined`

The logging component.

##### identity

`string`

The identity of the user to access the vault keys.

##### client

`IotaClient`

The client instance.

##### owner

`string`

The owner of the address.

##### transaction

`Transaction`

The transaction to execute.

##### options?

[`IIotaResponseOptions`](../interfaces/IIotaResponseOptions.md)

The transaction options.

#### Returns

`Promise`\<`IotaTransactionBlockResponse`\>

The transaction response.

***

### extractPayloadError() {#extractpayloaderror}

> `static` **extractPayloadError**(`error`): `IError`

Extract error from SDK payload.
Errors from the IOTA SDK are usually not JSON strings but objects.

#### Parameters

##### error

`unknown`

The error to extract.

#### Returns

`IError`

The extracted error.

***

### packageExistsOnNetwork() {#packageexistsonnetwork}

> `static` **packageExistsOnNetwork**(`client`, `packageId`): `Promise`\<`boolean`\>

Check if the package exists on the network.

#### Parameters

##### client

`IotaClient`

The client to use.

##### packageId

`string`

The package ID to check.

#### Returns

`Promise`\<`boolean`\>

True if the package exists, false otherwise.

***

### dryRunTransaction() {#dryruntransaction}

> `static` **dryRunTransaction**(`client`, `logging`, `txb`, `sender`, `operation`): `Promise`\<[`IIotaDryRun`](../interfaces/IIotaDryRun.md)\>

Dry run a transaction and log the results.

#### Parameters

##### client

`IotaClient`

The IOTA client.

##### logging

`ILoggingComponent` \| `undefined`

The logging component.

##### txb

`Transaction`

The transaction to dry run.

##### sender

`string`

The sender address.

##### operation

`string`

The operation to log.

#### Returns

`Promise`\<[`IIotaDryRun`](../interfaces/IIotaDryRun.md)\>

The dry run result including status, costs, events, and object changes.

***

### waitForTransactionConfirmation() {#waitfortransactionconfirmation}

> `static` **waitForTransactionConfirmation**(`client`, `digest`, `config`, `options?`): `Promise`\<`IotaTransactionBlockResponse`\>

Wait for a transaction to be indexed and available over the API.

#### Parameters

##### client

`IotaClient`

The IOTA client instance.

##### digest

`string`

The digest of the transaction to wait for.

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### options?

Additional options for the transaction query.

###### showEffects?

`boolean`

Whether to show effects.

###### showEvents?

`boolean`

Whether to show events.

###### showObjectChanges?

`boolean`

Whether to show object changes.

#### Returns

`Promise`\<`IotaTransactionBlockResponse`\>

The confirmed transaction response.

***

### isAbortError() {#isaborterror}

> `static` **isAbortError**(`error`, `code`): `boolean`

Check if the error is an abort error with a specific code.

#### Parameters

##### error

`unknown`

The error to check.

##### code

`number`

The error code to check for.

#### Returns

`boolean`

True if the error is an abort error, false otherwise.

***

### extractAbortCode() {#extractabortcode}

> `static` **extractAbortCode**(`response`): `number` \| `undefined`

Extracts the abort code from a transaction result if the transaction was aborted.

#### Parameters

##### response

`IotaTransactionBlockResponse`

The transaction result to extract the abort code from.

#### Returns

`number` \| `undefined`

The abort code if the transaction was aborted, or undefined if it was not an abort error or the code could not be extracted.

***

### isReservedObjectError() {#isreservedobjecterror}

> `static` **isReservedObjectError**(`error`): `boolean`

Check if an error is a retryable "owned object reserved by another transaction" conflict.
IOTA locks owned objects for the first in-flight transaction that claims them, so a
concurrent transaction referencing the same objects is rejected until the lock clears. This
only matches the transient "reserved for another transaction" case, not the non-retryable
"equivocated until the next epoch" case.

#### Parameters

##### error

`unknown`

The error to check.

#### Returns

`boolean`

True if the error is a retryable object reservation conflict.

***

### isRetryableObjectConflictError() {#isretryableobjectconflicterror}

> `static` **isRetryableObjectConflictError**(`error`): `boolean`

Check if an error is a retryable owned-object conflict caused by a concurrent transaction.
This covers both the "reserved for another transaction" case (the object is locked by an
in-flight transaction) and the "is not available for consumption" case (a concurrent
transaction already consumed the referenced version); a retry rebuild re-resolves to the
current version so both can recover. The non-retryable "equivocated until the next epoch"
case is not matched.

#### Parameters

##### error

`unknown`

The error to check.

#### Returns

`boolean`

True if the error is a retryable owned-object conflict.

***

### extractReservationConflictDigests() {#extractreservationconflictdigests}

> `static` **extractReservationConflictDigests**(`error`): `string`[]

Extract the conflicting transaction digests from an object reservation conflict error.
The node error lists the digests of the transactions currently locking the objects (the
underlying object ids are only present in the RPC error data, which the IOTA SDK discards).
Only the "reserved for another transaction" error carries digests, so this returns an empty
array for the stale-version conflict case.

#### Parameters

##### error

`unknown`

The error to extract from.

#### Returns

`string`[]

The conflicting transaction digests, or an empty array if none can be parsed.

***

### executeWithReservationRetry() {#executewithreservationretry}

> `static` **executeWithReservationRetry**\<`T`\>(`config`, `operation`): `Promise`\<`T`\>

Run a transaction submission operation, retrying with exponential back-off if it is rejected
because of a retryable owned-object conflict with a concurrent transaction (the objects are
reserved by an in-flight transaction, or the referenced version was already consumed).
Other errors are rethrown immediately. If the conflict persists after all retries a clear,
retryable error is thrown instead of the opaque underlying failure.

#### Type Parameters

##### T

`T`

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration controlling retry counts and delays.

##### operation

() => `Promise`\<`T`\>

The transaction submission operation to run.

#### Returns

`Promise`\<`T`\>

The result of the operation.

***

### prepareAndPostGasStationTransaction() {#prepareandpostgasstationtransaction}

> `static` **prepareAndPostGasStationTransaction**(`config`, `vaultConnector`, `identity`, `client`, `owner`, `transaction`, `options?`): `Promise`\<`IotaTransactionBlockResponse`\>

Prepare and post a transaction using gas station sponsoring.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

##### identity

`string`

The identity of the user to access the vault keys.

##### client

`IotaClient`

The client instance.

##### owner

`string`

The owner of the address.

##### transaction

`Transaction`

The transaction to execute.

##### options?

[`IIotaResponseOptions`](../interfaces/IIotaResponseOptions.md)

Response options including confirmation behavior.

#### Returns

`Promise`\<`IotaTransactionBlockResponse`\>

The transaction response.

***

### isGasStationEnabled() {#isgasstationenabled}

> `static` **isGasStationEnabled**(`config`): `boolean`

Check whether gas station mode is fully configured.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration to check.

#### Returns

`boolean`

True if both the gas station url and auth token are set.

***

### checkGasStationConnectivity() {#checkgasstationconnectivity}

> `static` **checkGasStationConnectivity**(`config`): `Promise`\<`boolean`\>

Check whether the gas station HTTP endpoint is reachable and responding.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing gas station settings.

#### Returns

`Promise`\<`boolean`\>

True if the gas station responds with "OK", false otherwise.

***

### checkGasStationIsWorking() {#checkgasstationisworking}

> `static` **checkGasStationIsWorking**(`config`): `Promise`\<`void`\>

Verify the gas station is fully operational by executing a sponsored transaction
end-to-end (reserve gas → sign → execute → confirm).

A read-only Move clock call is used as the test payload so that no objects are created
and no on-chain state is left behind.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing gas station settings and client options.

#### Returns

`Promise`\<`void`\>

***

### buildGasStationParams() {#buildgasstationparams}

> `static` **buildGasStationParams**(`config`): [`IGasStationParams`](../interfaces/IGasStationParams.md)

Build the resolved gas station parameters, applying the same defaults as gas reservation.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing gas station settings.

#### Returns

[`IGasStationParams`](../interfaces/IGasStationParams.md)

The resolved gas station parameters.

***

### wrapGasStationError() {#wrapgasstationerror}

> `static` **wrapGasStationError**(`error`): `GeneralError`

Wrap a failure from a gas station sponsored path in the standard error.

#### Parameters

##### error

`unknown`

The error from the sponsored execution.

#### Returns

`GeneralError`

The wrapped error.

***

### reserveGas() {#reservegas}

> `static` **reserveGas**(`config`): `Promise`\<[`IGasReservationResult`](../interfaces/IGasReservationResult.md)\>

Reserve gas from the gas station.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing gas station settings.

#### Returns

`Promise`\<[`IGasReservationResult`](../interfaces/IGasReservationResult.md)\>

The gas reservation result.

***

### executeGasStationTransaction() {#executegasstationtransaction}

> `static` **executeGasStationTransaction**(`config`, `reservationId`, `transactionBytes`, `userSignature`): `Promise`\<`IotaTransactionBlockResponse`\>

Execute a sponsored transaction through the gas station.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing gas station settings.

##### reservationId

`number`

The reservation ID from gas reservation.

##### transactionBytes

`Uint8Array`

The unsigned transaction bytes.

##### userSignature

`string`

The user's signature.

#### Returns

`Promise`\<`IotaTransactionBlockResponse`\>

The transaction response.

***

### executeAndConfirmGasStationTransaction() {#executeandconfirmgasstationtransaction}

> `static` **executeAndConfirmGasStationTransaction**(`config`, `client`, `reservationId`, `transactionBytes`, `userSignature`, `options?`): `Promise`\<`IotaTransactionBlockResponse`\>

Execute and confirm a gas station transaction.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing gas station settings.

##### client

`IotaClient`

The IOTA client for confirmation.

##### reservationId

`number`

The reservation ID from gas reservation.

##### transactionBytes

`Uint8Array`

The unsigned transaction bytes.

##### userSignature

`string`

The user's signature.

##### options?

[`IIotaResponseOptions`](../interfaces/IIotaResponseOptions.md)

Response options including confirmation behavior.

#### Returns

`Promise`\<`IotaTransactionBlockResponse`\>

The transaction response (confirmed if waitForConfirmation is true).

***

### fundAddress() {#fundaddress}

> `static` **fundAddress**(`config`, `faucetUrl`, `identity`, `address`, `timeoutInSeconds?`): `Promise`\<`bigint`\>

Fund an address with IOTA from the faucet.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing endpoint information.

##### faucetUrl

`string`

The URL of the faucet to request funds from.

##### identity

`string`

The identity of the user to access the vault keys.

##### address

`string`

The address to fund.

##### timeoutInSeconds?

`number` = `60`

The timeout in seconds to wait for the funding to complete.

#### Returns

`Promise`\<`bigint`\>

The amount funded.

***

### ensureBalance() {#ensurebalance}

> `static` **ensureBalance**(`config`, `faucetUrl`, `identity`, `address`, `ensureBalance`, `timeoutInSeconds?`): `Promise`\<`boolean`\>

Ensure the balance for the given address is at least the given amount.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing endpoint information.

##### faucetUrl

`string` \| `undefined`

The URL of the faucet to request funds from.

##### identity

`string`

The identity of the user to access the vault keys.

##### address

`string`

The address to ensure the balance for.

##### ensureBalance

`bigint`

The minimum balance to ensure.

##### timeoutInSeconds?

`number`

Optional timeout in seconds, defaults to 10 seconds.

#### Returns

`Promise`\<`boolean`\>

True if the balance is at least the given amount, false otherwise.

***

### getBalance() {#getbalance}

> `static` **getBalance**(`config`, `address`): `Promise`\<`bigint`\>

Get the balance for the given address.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration containing endpoint information.

##### address

`string`

The address to get the balance for.

#### Returns

`Promise`\<`bigint`\>

The balance of the given address.

***

### transactionFromBytes() {#transactionfrombytes}

> `static` **transactionFromBytes**(`bytes`): `Transaction`

Create a transaction instance from the given bytes.

#### Parameters

##### bytes

`Uint8Array`

The transaction bytes to create the transaction from.

#### Returns

`Transaction`

The transaction instance created from the given bytes.
