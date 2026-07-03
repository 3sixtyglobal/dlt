# Interface: IIotaConfig

Configuration for IOTA.

## Properties

### clientOptions {#clientoptions}

> **clientOptions**: `NetworkOrTransport`

The configuration for the client.

***

### network {#network}

> **network**: `string`

The network the operations are being performed on.

***

### vaultMnemonicId? {#vaultmnemonicid}

> `optional` **vaultMnemonicId?**: `string`

The id of the entry in the vault containing the mnemonic.

#### Default

```ts
mnemonic
```

***

### vaultSeedId? {#vaultseedid}

> `optional` **vaultSeedId?**: `string`

The id of the entry in the vault containing the seed.

#### Default

```ts
seed
```

***

### coinType? {#cointype}

> `optional` **coinType?**: `number`

The coin type.

#### Default

```ts
IOTA 4218
```

***

### maxAddressScanRange? {#maxaddressscanrange}

> `optional` **maxAddressScanRange?**: `number`

The maximum range to scan for addresses.

#### Default

```ts
1000
```

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
