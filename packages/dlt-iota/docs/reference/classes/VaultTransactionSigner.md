# Class: VaultTransactionSigner

A transaction signer that delegates all signing operations to the vault connector,
ensuring the private key is never exposed to application code.

## Implements

- [`ITransactionSigner`](../interfaces/ITransactionSigner.md)

## Constructors

### Constructor

> **new VaultTransactionSigner**(`vaultConnector`, `keyName`, `publicKey`): `VaultTransactionSigner`

Create a new VaultTransactionSigner.

#### Parameters

##### vaultConnector

`IVaultConnector`

The vault connector used to perform signing operations.

##### keyName

`string`

The name of the key in the vault to use for signing.

##### publicKey

`Uint8Array`

The public key bytes corresponding to the vault key.

#### Returns

`VaultTransactionSigner`

## Methods

### sign() {#sign}

> **sign**(`txDataBcs`): `Promise`\<`string`\>

Sign the BCS-encoded transaction data.
Applies the TransactionData intent, hashes the result, signs via the vault,
and returns a serialized IOTA signature string.

#### Parameters

##### txDataBcs

`Uint8Array`

The raw transaction bytes to sign.

#### Returns

`Promise`\<`string`\>

The serialized signature string.

#### Implementation of

[`ITransactionSigner`](../interfaces/ITransactionSigner.md).[`sign`](../interfaces/ITransactionSigner.md#sign)

***

### publicKey() {#publickey}

> **publicKey**(): `Promise`\<`PublicKey`\>

Get the public key for this signer.

#### Returns

`Promise`\<`PublicKey`\>

The Ed25519 public key.

#### Implementation of

[`ITransactionSigner`](../interfaces/ITransactionSigner.md).[`publicKey`](../interfaces/ITransactionSigner.md#publickey)

***

### iotaPublicKeyBytes() {#iotapublickeybytes}

> **iotaPublicKeyBytes**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Get the IOTA-formatted public key bytes (scheme flag byte followed by the raw key bytes).

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The IOTA public key bytes.

#### Implementation of

[`ITransactionSigner`](../interfaces/ITransactionSigner.md).[`iotaPublicKeyBytes`](../interfaces/ITransactionSigner.md#iotapublickeybytes)

***

### keyId() {#keyid}

> **keyId**(): `string`

Get the vault key name used by this signer.

#### Returns

`string`

The key name.

#### Implementation of

[`ITransactionSigner`](../interfaces/ITransactionSigner.md).[`keyId`](../interfaces/ITransactionSigner.md#keyid)
