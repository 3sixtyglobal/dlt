# Interface: IIotaConfig

Configuration for IOTA.

## Extends

- `IAccountConfig`

## Properties

### vaultSeedId? {#vaultseedid}

> `optional` **vaultSeedId?**: `string`

The ID of the vault seed.

#### Inherited from

`IAccountConfig.vaultSeedId`

***

### vaultMnemonicId? {#vaultmnemonicid}

> `optional` **vaultMnemonicId?**: `string`

The ID of the vault mnemonic.

#### Inherited from

`IAccountConfig.vaultMnemonicId`

***

### coinType? {#cointype}

> `optional` **coinType?**: `number`

The coin type.

#### Inherited from

`IAccountConfig.coinType`

***

### maxAddressScanRange? {#maxaddressscanrange}

> `optional` **maxAddressScanRange?**: `number`

The maximum number of addresses to scan for the account.

#### Inherited from

`IAccountConfig.maxAddressScanRange`

***

### clientOptions {#clientoptions}

> **clientOptions**: `NetworkOrTransport`

The configuration for the client.

***

### network {#network}

> **network**: `string`

The network the operations are being performed on.

***

### inclusionTimeoutSeconds? {#inclusiontimeoutseconds}

> `optional` **inclusionTimeoutSeconds?**: `number`

The length of time to wait for the inclusion of a transaction in seconds.

#### Default

```ts
60
```

***

### gasStation? {#gasstation}

> `optional` **gasStation?**: [`IGasStationConfig`](IGasStationConfig.md)

Gas station configuration for sponsored transactions.
If provided, transactions will be processed through the gas station.

***

### gasBudget? {#gasbudget}

> `optional` **gasBudget?**: `number`

The default gas budget for all transactions (including sponsored and direct).

#### Default

```ts
50000000
```

***

### gasReservationDuration? {#gasreservationduration}

> `optional` **gasReservationDuration?**: `number`

The default gas reservation duration in seconds for all transactions (including sponsored and direct).

#### Default

```ts
60
```

***

### enableCostLogging? {#enablecostlogging}

> `optional` **enableCostLogging?**: `boolean`

Enable cost logging for transactions.

#### Default

```ts
false
```

***

### objectLockRetries? {#objectlockretries}

> `optional` **objectLockRetries?**: `number`

The number of times to retry a transaction that is rejected because one or more of its owned
objects is reserved by another in-flight transaction.

#### Default

```ts
3
```

***

### objectLockRetryDelayMs? {#objectlockretrydelayms}

> `optional` **objectLockRetryDelayMs?**: `number`

The base delay in milliseconds between object-lock retries; the delay grows exponentially
with each attempt.

#### Default

```ts
1000
```
