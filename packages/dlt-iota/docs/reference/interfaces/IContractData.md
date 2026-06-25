# Interface: IContractData

Interface for contract data stored in smart-contract-deployments.json

## Properties

### packageId {#packageid}

> **packageId**: `string`

Package ID generated during build

***

### packageBytecode {#packagebytecode}

> **packageBytecode**: `string` \| `string`[]

Base64-encoded package bytecode

***

### deployedPackageId? {#deployedpackageid}

> `optional` **deployedPackageId?**: `string`

Package ID from actual deployment

***

### lastDeployedPackageId? {#lastdeployedpackageid}

> `optional` **lastDeployedPackageId?**: `string`

Previous deployed package ID for upgrade chain tracking

***

### upgradeCapabilityId? {#upgradecapabilityid}

> `optional` **upgradeCapabilityId?**: `string`

UpgradeCap object ID for package upgrades

***

### migrationStateId? {#migrationstateid}

> `optional` **migrationStateId?**: `string`

Migration state ID for tracking contract migrations
