# Class: IotaSmartContractUtils

Utility class providing common smart contract operations for IOTA-based contracts.

## Constructors

### Constructor

> **new IotaSmartContractUtils**(): `IotaSmartContractUtils`

#### Returns

`IotaSmartContractUtils`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### migrateSmartContract() {#migratesmartcontract}

> `static` **migrateSmartContract**(`config`, `client`, `vaultConnector`, `logging`, `gasBudget`, `identity`, `objectId`, `namespace`, `packageId`, `deploymentConfig`, `accountAddressIndex?`, `walletAddressIndex?`): `Promise`\<`void`\>

Migrate a smart contract object to the current version using admin privileges.
This is a generic migration method that works with any IOTA smart contract.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### logging

`ILoggingComponent` \| `undefined`

Optional logging component.

##### gasBudget

`number`

The gas budget for the transaction.

##### identity

`string`

The identity of the controller with admin privileges.

##### objectId

`string`

The ID of the object to migrate.

##### namespace

`string`

The contract namespace (e.g., "nft", "verifiable_storage").

##### packageId

`string`

The deployed package ID for the contract.

##### deploymentConfig

[`ISmartContractDeployments`](../type-aliases/ISmartContractDeployments.md)

The deployment configuration containing object IDs.

##### accountAddressIndex?

`number`

Optional account address index for the controller.

##### walletAddressIndex?

`number`

Optional wallet address index for the controller.

#### Returns

`Promise`\<`void`\>

Promise that resolves when migration is complete.

***

### enableMigration() {#enablemigration}

> `static` **enableMigration**(`config`, `client`, `vaultConnector`, `logging`, `gasBudget`, `identity`, `namespace`, `packageId`, `deploymentConfig`, `accountAddressIndex?`, `walletAddressIndex?`): `Promise`\<`void`\>

Enable migration operations using admin privileges.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### logging

`ILoggingComponent` \| `undefined`

Optional logging component.

##### gasBudget

`number`

The gas budget for the transaction.

##### identity

`string`

The identity of the controller with admin privileges.

##### namespace

`string`

The contract namespace (e.g., "nft", "verifiable_storage").

##### packageId

`string`

The deployed package ID for the contract.

##### deploymentConfig

[`ISmartContractDeployments`](../type-aliases/ISmartContractDeployments.md)

The deployment configuration containing object IDs.

##### accountAddressIndex?

`number`

Optional account address index for the controller.

##### walletAddressIndex?

`number`

Optional wallet address index for the controller.

#### Returns

`Promise`\<`void`\>

Promise that resolves when migration is enabled.

***

### disableMigration() {#disablemigration}

> `static` **disableMigration**(`config`, `client`, `vaultConnector`, `logging`, `gasBudget`, `identity`, `namespace`, `packageId`, `deploymentConfig`, `accountAddressIndex?`, `walletAddressIndex?`): `Promise`\<`void`\>

Disable migration operations using admin privileges.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### logging

`ILoggingComponent` \| `undefined`

Optional logging component.

##### gasBudget

`number`

The gas budget for the transaction.

##### identity

`string`

The identity of the controller with admin privileges.

##### namespace

`string`

The contract namespace (e.g., "nft", "verifiable_storage").

##### packageId

`string`

The deployed package ID for the contract.

##### deploymentConfig

[`ISmartContractDeployments`](../type-aliases/ISmartContractDeployments.md)

The deployment configuration containing object IDs.

##### accountAddressIndex?

`number`

Optional account address index for the controller.

##### walletAddressIndex?

`number`

Optional wallet address index for the controller.

#### Returns

`Promise`\<`void`\>

Promise that resolves when migration is disabled.

***

### isMigrationActive() {#ismigrationactive}

> `static` **isMigrationActive**(`config`, `client`, `vaultConnector`, `namespace`, `packageId`, `deploymentConfig`, `identity`, `accountAddressIndex?`, `walletAddressIndex?`): `Promise`\<`boolean`\>

Check if migration is currently active for a smart contract.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### namespace

`string`

The contract namespace (e.g., "nft", "verifiable_storage").

##### packageId

`string`

The deployed package ID for the contract.

##### deploymentConfig

[`ISmartContractDeployments`](../type-aliases/ISmartContractDeployments.md)

The deployment configuration containing object IDs.

##### identity

`string`

The identity for MigrationState discovery.

##### accountAddressIndex?

`number`

Optional account address index for the controller.

##### walletAddressIndex?

`number`

Optional wallet address index for the controller.

#### Returns

`Promise`\<`boolean`\>

True if migration is enabled, false otherwise.

***

### getCurrentContractVersion() {#getcurrentcontractversion}

> `static` **getCurrentContractVersion**(`config`, `client`, `vaultConnector`, `namespace`, `packageId`, `identity`, `accountAddressIndex?`, `walletAddressIndex?`): `Promise`\<`number`\>

Get the current contract version from the deployed smart contract.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### namespace

`string`

The contract namespace (e.g., "nft", "verifiable_storage").

##### packageId

`string`

The deployed package ID for the contract.

##### identity

`string`

The identity for package controller address.

##### accountAddressIndex?

`number`

Optional account address index for the controller.

##### walletAddressIndex?

`number`

Optional wallet address index for the controller.

#### Returns

`Promise`\<`number`\>

The current version number of the contract.

***

### validateObjectVersion() {#validateobjectversion}

> `static` **validateObjectVersion**\<`T`\>(`config`, `client`, `vaultConnector`, `namespace`, `packageId`, `identity`, `objectId`, `versionExtractor`, `accountAddressIndex?`, `walletAddressIndex?`): `Promise`\<`boolean`\>

Validate that an object version is compatible with the current contract.

#### Type Parameters

##### T

`T`

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### namespace

`string`

The contract namespace (e.g., "nft", "verifiable_storage").

##### packageId

`string`

The deployed package ID for the contract.

##### identity

`string`

The identity for version checking.

##### objectId

`string`

The object ID to validate.

##### versionExtractor

(`content`) => `number`

Function to extract version from object content.

##### accountAddressIndex?

`number`

Optional account address index for the controller.

##### walletAddressIndex?

`number`

Optional wallet address index for the controller.

#### Returns

`Promise`\<`boolean`\>

True if the object version is compatible, false otherwise.
