# Class: IotaIdentityUtils

Utility class for resolving IOTA Identity on-chain objects required by
the NFT mint_with_identity() Move contract function.

## Constructors

### Constructor

> **new IotaIdentityUtils**(): `IotaIdentityUtils`

#### Returns

`IotaIdentityUtils`

## Properties

### CLASS\_NAME

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### getControllerCapInfo()

> `static` **getControllerCapInfo**(`identityId`, `controllerAddress`, `client`): `Promise`\<[`IIotaControllerCapInfo`](../interfaces/IIotaControllerCapInfo.md)\>

Resolve the on-chain object IDs for an identity and its controller token.
Returns the IDs needed to call mint_with_identity() on the NFT Move contract.

#### Parameters

##### identityId

`string`

The DID of the identity (e.g. "did:iota:testnet:0x...").

##### controllerAddress

`string`

The on-chain address of the controller wallet.

##### client

`IotaClient`

The IOTA client instance.

#### Returns

`Promise`\<[`IIotaControllerCapInfo`](../interfaces/IIotaControllerCapInfo.md)\>

The identity object ID and controller token object ID.

#### Throws

NotFoundError if the identity does not exist on-chain.

#### Throws

GeneralError if the identity has been deleted or the controller token is not found.
