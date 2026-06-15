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

### getKeyPair() {#getkeypair}

> `static` **getKeyPair**(`vaultConnector`, `config`, `identity`, `accountIndex`, `addressIndex`, `isInternal?`): `Promise`\<\{ `privateKey`: `Uint8Array`; `publicKey`: `Uint8Array`; \}\>

Get a key pair for the specified index.

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

The account index to get the key pair for.

##### addressIndex

`number`

The address index to get the key pair for.

##### isInternal?

`boolean`

Whether the address is internal.

#### Returns

`Promise`\<\{ `privateKey`: `Uint8Array`; `publicKey`: `Uint8Array`; \}\>

The key pair containing private key and public key.

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

### findAddress() {#findaddress}

> `static` **findAddress**(`vaultConnector`, `config`, `identity`, `address`, `accountIndex`, `isInternal?`, `startScanIndex?`, `maxScanRange?`): `Promise`\<\{ `address`: `string`; `privateKey`: `Uint8Array`; `publicKey`: `Uint8Array`; \}\>

Find the address in the seed.

#### Parameters

##### vaultConnector

`IVaultConnector`

The vault connector to use.

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The configuration to use.

##### identity

`string`

The identity of the user to access the vault keys.

##### address

`string`

The address to find.

##### accountIndex

`number`

The account index to search.

##### isInternal?

`boolean`

Whether to search internal addresses.

##### startScanIndex?

`number`

The address index to start scanning from.

##### maxScanRange?

`number`

The maximum range to scan.

#### Returns

`Promise`\<\{ `address`: `string`; `privateKey`: `Uint8Array`; `publicKey`: `Uint8Array`; \}\>

The address key pair.

#### Throws

Error if the address is not found.

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
