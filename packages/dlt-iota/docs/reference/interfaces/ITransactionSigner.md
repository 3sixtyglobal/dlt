# Interface: ITransactionSigner

Interface for a transaction signer backed by a secure key store.

## Methods

### sign() {#sign}

> **sign**(`txDataBcs`): `Promise`\<`string`\>

Sign the BCS-encoded transaction data and return a serialized IOTA signature string.

#### Parameters

##### txDataBcs

`Uint8Array`

The raw transaction bytes to sign.

#### Returns

`Promise`\<`string`\>

The serialized signature string (scheme flag + signature + public key, base64-encoded).

***

### publicKey() {#publickey}

> **publicKey**(): `Promise`\<`PublicKey`\>

Get the public key for this signer.

#### Returns

`Promise`\<`PublicKey`\>

The public key.

***

### iotaPublicKeyBytes() {#iotapublickeybytes}

> **iotaPublicKeyBytes**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Get the IOTA-formatted public key bytes (scheme flag byte followed by the raw key bytes).

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The IOTA public key bytes.

***

### keyId() {#keyid}

> **keyId**(): `string`

Get the key identifier for this signer.

#### Returns

`string`

The key identifier.
