# Interface: IIotaConfig

Configuration for IOTA.

## Properties

### clientOptions

> **clientOptions**: `NetworkOrTransport`

The configuration for the client.

***

### network

> **network**: `string`

The network the operations are being performed on.

***

### vaultMnemonicId?

> `optional` **vaultMnemonicId**: `string`

The id of the entry in the vault containing the mnemonic.

***

### vaultSeedId?

> `optional` **vaultSeedId**: `string`

The id of the entry in the vault containing the seed.

***

### coinType?

> `optional` **coinType**: `number`

The coin type.

***

### maxAddressScanRange?

> `optional` **maxAddressScanRange**: `number`

The maximum range to scan for addresses.

***

### inclusionTimeoutSeconds?

> `optional` **inclusionTimeoutSeconds**: `number`

The length of time to wait for the inclusion of a transaction in seconds.

***

### gasStation?

> `optional` **gasStation**: [`IGasStationConfig`](IGasStationConfig.md)

Gas station configuration for sponsored transactions.
If provided, transactions will be processed through the gas station.

***

### gasBudget?

> `optional` **gasBudget**: `number`

The default gas budget for all transactions (including sponsored and direct).

***

### enableCostLogging?

> `optional` **enableCostLogging**: `boolean`

Enable cost logging for transactions.
