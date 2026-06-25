# Class: VaultJwtSigner

Factory that creates a vault-backed StorageSigner for IOTA Identity operations.
The private key never leaves the vault — only the raw signing operation is delegated.

The returned StorageSigner is a genuine WASM object, satisfying the internal validation
that IdentityClient.create() performs on the signer's iotaPublicKeyBytes() path.

## Constructors

### Constructor

> **new VaultJwtSigner**(): `VaultJwtSigner`

#### Returns

`VaultJwtSigner`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### create() {#create}

> `static` **create**(`vaultConnector`, `config`, `identity`, `accountIndex`, `addressIndex`): `Promise`\<`StorageSigner`\>

Create a StorageSigner whose cryptographic operations are backed by the vault connector.

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

`Promise`\<`StorageSigner`\>

A StorageSigner backed by the vault for the specified key.
