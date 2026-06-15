# Interface: IGasStationExecuteResponse

Interface for the gas station execute transaction response.

## Properties

### effects {#effects}

> **effects**: `object`

The transaction effects from the IOTA network.

#### Index Signature

\[`key`: `string`\]: `unknown`

Additional fields from the IOTA network effects object.

#### transactionDigest

> **transactionDigest**: `string`

The transaction digest.

***

### error? {#error}

> `optional` **error?**: `string` \| `null`

Error message if the request failed.
