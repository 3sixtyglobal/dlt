# Interface: INetworkConfig

Network configuration interface

## Properties

### network {#network}

> **network**: `NetworkTypes`

The network type

***

### platform {#platform}

> **platform**: `"iota"`

The platform type

***

### rpc {#rpc}

> **rpc**: `object`

The RPC configuration

#### url

> **url**: `string`

#### timeout?

> `optional` **timeout**: `number`

***

### deployment {#deployment}

> **deployment**: `object`

The deployment configuration

#### gasBudget

> **gasBudget**: `number`

#### confirmationTimeout?

> `optional` **confirmationTimeout**: `number`

#### wallet

> **wallet**: `object`

##### wallet.addressIndex

> **addressIndex**: `number`

#### gasStation?

> `optional` **gasStation**: `object`

##### gasStation.url

> **url**: `string`

##### gasStation.authToken

> **authToken**: `string`

***

### contracts? {#contracts}

> `optional` **contracts**: `object`

The contracts configuration

#### Index Signature

\[`key`: `string`\]: `object`
