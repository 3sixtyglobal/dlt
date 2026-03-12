# Interface: IIotaControllerCapInfo

On-chain object IDs needed to call mint_with_identity() on the NFT Move contract.

## Properties

### identityObjectId {#identityobjectid}

> **identityObjectId**: `string`

The on-chain Object ID of the Identity Move object (hex string, e.g. "0x...").
Used as the Identity argument in mint_with_identity().

***

### controllerCapObjectId {#controllercapobjectid}

> **controllerCapObjectId**: `string`

The on-chain Object ID of the ControllerToken Move object (hex string, e.g. "0x...").
Proves that the controller address controls identityObjectId.
Used as the ControllerCap argument in mint_with_identity().
