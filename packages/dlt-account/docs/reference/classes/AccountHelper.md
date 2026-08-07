# Class: AccountHelper

Helper class for account management operations.

## Constructors

### Constructor

> **new AccountHelper**(): `AccountHelper`

#### Returns

`AccountHelper`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

***

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

### DEFAULT\_CALC\_CHUNK\_SIZE {#default_calc_chunk_size}

> `readonly` `static` **DEFAULT\_CALC\_CHUNK\_SIZE**: `number` = `25`

Default pre-calculation chunk size.

***

### DEFAULT\_SCAN\_RANGE\_SIZE {#default_scan_range_size}

> `readonly` `static` **DEFAULT\_SCAN\_RANGE\_SIZE**: `number` = `1000`

Default scan range.

## Methods

### createAccountKeys() {#createaccountkeys}

> `static` **createAccountKeys**(`accountConfig`, `vaultConnector`, `identity`, `mnemonic?`, `accountIndex?`): `Promise`\<`string`\>

Create a new account by generating a mnemonic and seed, storing them in the vault, and pre-caching the first chunk of derived keys.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

##### identity

`string`

The identity of the user to access the vault keys.

##### mnemonic?

`string`

The mnemonic to store, if undefined a new one will be generated and returned.

##### accountIndex?

`number`

The account index to pre-cache.

#### Returns

`Promise`\<`string`\>

The mnemonic that was stored.

***

### renameAccountKeys() {#renameaccountkeys}

> `static` **renameAccountKeys**(`accountConfig`, `vaultConnector`, `fromIdentity`, `toIdentity`): `Promise`\<`void`\>

Rename all vault entries for an account from one identity to another.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

##### fromIdentity

`string`

The source identity whose vault entries should be copied.

##### toIdentity

`string`

The destination identity that will receive the copied entries.

#### Returns

`Promise`\<`void`\>

***

### removeAccountKeys() {#removeaccountkeys}

> `static` **removeAccountKeys**(`accountConfig`, `vaultConnector`, `identity`): `Promise`\<`void`\>

Remove all vault entries for an account.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

##### identity

`string`

The identity of the user whose vault keys should be removed.

#### Returns

`Promise`\<`void`\>

***

### buildSeedKey() {#buildseedkey}

> `static` **buildSeedKey**(`identity`, `vaultSeedId?`): `string`

Get the key for storing the seed.

#### Parameters

##### identity

`string`

The identity to use.

##### vaultSeedId?

`string`

The seed ID to use.

#### Returns

`string`

The seed key.

***

### buildMnemonicKey() {#buildmnemonickey}

> `static` **buildMnemonicKey**(`identity`, `vaultMnemonicId?`): `string`

Get the key for storing the mnemonic.

#### Parameters

##### identity

`string`

The identity to use.

##### vaultMnemonicId?

`string`

The mnemonic ID to use.

#### Returns

`string`

The mnemonic key.

***

### getPublicKeys() {#getpublickeys}

> `static` **getPublicKeys**(`accountConfig`, `vaultConnector`, `identity`, `accountIndex`, `internal`, `addressIndex`, `seedProvider`): `Promise`\<`string`[]\>

Ensure a range of BIP44-derived keys are registered as individual vault keys and return their public keys.
If the first key of the range already exists the range is considered registered and only public keys are derived.
If not registered, all keys are derived and added to the vault before returning the public keys.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector to use.

##### identity

`string`

The identity of the user to access the vault keys.

##### accountIndex

`number`

The account index.

##### internal

`boolean`

Whether the addresses are internal or external.

##### addressIndex

`number`

Any address index within the desired chunk; aligned internally.

##### seedProvider

() => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Callback invoked at most once per call to supply the seed when a chunk is not yet registered.

#### Returns

`Promise`\<`string`[]\>

The base64-encoded public keys for each address in the range.

***

### buildAddressKeyName() {#buildaddresskeyname}

> `static` **buildAddressKeyName**(`identity`, `accountIndex`, `internal`, `addressIndex`): `string`

Build the vault key name for a specific derived address.

#### Parameters

##### identity

`string`

The identity to use.

##### accountIndex

`number`

The account index.

##### internal

`boolean`

Whether the address is internal or external.

##### addressIndex

`number`

The address index.

#### Returns

`string`

The vault key name.

***

### getAddress() {#getaddress}

> `static` **getAddress**(`accountConfig`, `vaultConnector`, `identity`, `accountIndex`, `startAddressIndex`, `isInternal?`): `Promise`\<`string`\>

Get address for the identity.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

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

> `static` **getAddresses**(`accountConfig`, `vaultConnector`, `identity`, `accountIndex`, `startAddressIndex`, `count`, `isInternal?`): `Promise`\<`string`[]\>

Get addresses for the identity.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector.

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

### getSeed() {#getseed}

> `static` **getSeed**(`accountConfig`, `vaultConnector`, `identity`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Get the seed from the vault, deriving it from the mnemonic if necessary.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector to use.

##### identity

`string`

The identity of the user to access the vault keys.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The seed bytes.

***

### findAddressKey() {#findaddresskey}

> `static` **findAddressKey**(`accountConfig`, `vaultConnector`, `identity`, `address`, `accountIndex?`): `Promise`\<\{ `keyName`: `string`; `publicKey`: `Uint8Array`; \}\>

Find the vault key name and public key for a specific address by scanning derived keys.

#### Parameters

##### accountConfig

[`IAccountConfig`](../interfaces/IAccountConfig.md) \| `undefined`

The account configuration.

##### vaultConnector

`IVaultConnector`

The vault connector to use.

##### identity

`string`

The identity of the user to access the vault keys.

##### address

`string`

The owner address whose key should be located.

##### accountIndex?

`number` = `0`

The account index to search.

#### Returns

`Promise`\<\{ `keyName`: `string`; `publicKey`: `Uint8Array`; \}\>

The vault key name and the public key bytes.

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
