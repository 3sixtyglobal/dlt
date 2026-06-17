# Class: VaultSigner

A signer that delegates all signing to the vault connector, ensuring the private key
is never exposed to application code.

## Extends

- `Signer`

## Constructors

### Constructor

> **new VaultSigner**(`vaultConnector`, `keyName`, `publicKey`): `VaultSigner`

Create a new VaultSigner.

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

`VaultSigner`

#### Overrides

`Signer.constructor`

## Methods

### getKeyScheme() {#getkeyscheme}

> **getKeyScheme**(): `SignatureScheme`

Get the key scheme.

#### Returns

`SignatureScheme`

The signature scheme.

#### Overrides

`Signer.getKeyScheme`

***

### getPublicKey() {#getpublickey}

> **getPublicKey**(): `Ed25519PublicKey`

Get the public key.

#### Returns

`Ed25519PublicKey`

The Ed25519 public key.

#### Overrides

`Signer.getPublicKey`

***

### sign() {#sign}

> **sign**(`bytes`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the provided bytes via the vault connector.

#### Parameters

##### bytes

`Uint8Array`

The bytes to sign.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The raw Ed25519 signature bytes.

#### Overrides

`Signer.sign`
