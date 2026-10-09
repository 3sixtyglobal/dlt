# DLT IOTA Examples

These snippets show practical ways to configure clients, derive addresses, post transactions, and manage contract migration flows in production-style integrations.

## Iota

```typescript
import { Iota, NetworkTypes, type IIotaConfig } from '@3sixty/dlt-iota';

const config: IIotaConfig = {
  network: NetworkTypes.Testnet,
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  },
  inclusionTimeoutSeconds: 45
};

Iota.populateConfig(config);
const client = Iota.createClient(config);

console.log(config.coinType); // 4218
console.log(config.vaultMnemonicId); // mnemonic
console.log(client !== undefined); // true
```

```typescript
import { Bip39 } from '@3sixty/crypto';
import { Iota } from '@3sixty/dlt-iota';

const mnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const seed = Bip39.mnemonicToSeed(mnemonic);

const vault = VaultConnectorFactort.get('vault');

const addresses = Iota.getAddresses(vault, {}, 0, 0, 3);
const keyPair = Iota.getKeyPair(vault, {}, 0, 0);
const found = Iota.findAddress(vault, {}, addresses[0], 50);

console.log(addresses.length); // 3
console.log(found.address === addresses[0]); // true
console.log(keyPair.publicKey.length > 0); // true
```

```typescript
import { Converter } from '@3sixty/core';
import { Iota, type IIotaConfig } from '@3sixty/dlt-iota';
import type { IVaultConnector } from '@3sixty/vault-models';

const config: IIotaConfig = {
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  },
  vaultMnemonicId: 'deployment-mnemonic',
  vaultSeedId: 'deployment-seed'
};

const vaultConnector: IVaultConnector = {
  async getSecret<T>(key: string): Promise<T> {
    if (key.endsWith('/deployment-seed')) {
      return Converter.bytesToBase64(new Uint8Array(32).fill(7)) as T;
    }
    if (key.endsWith('/deployment-mnemonic')) {
      const value =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      return value as T;
    }
    throw new Error('Unknown key');
  }
};
```

```typescript
import {
  Iota,
  type IIotaClient,
  type IIotaConfig,
  type IIotaTransaction,
  type IIotaTransactionBlockResponse
} from '@3sixty/dlt-iota';
import type { IVaultConnector } from '@3sixty/vault-models';

const config: IIotaConfig = {
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  },
  waitForConfirmation: true
};

const tx = Iota.createTransaction();
tx.setSender('0xabc123');

const responseOptions = {
  waitForConfirmation: true,
  dryRunLabel: 'transfer_iota'
};

const client = {} as IIotaClient;
const vaultConnector = {} as IVaultConnector;

const result: IIotaTransactionBlockResponse = await Iota.prepareAndPostTransaction(
  config,
  vaultConnector,
  undefined,
  'deployer',
  client,
  '0xabc123',
  tx as IIotaTransaction,
  responseOptions
);

await Iota.waitForTransactionConfirmation(client, result.digest, config, {
  showEffects: true,
  showEvents: true,
  showObjectChanges: true
});

console.log(typeof result.digest === 'string'); // true
```

```typescript
import {
  Iota,
  type IIotaClient,
  type IIotaConfig,
  type IIotaTransaction,
  type IIotaTransactionBlockResponse
} from '@3sixty/dlt-iota';
import type { IVaultConnector } from '@3sixty/vault-models';

const config: IIotaConfig = {
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  },
  gasBudget: 80_000_000,
  gasStation: {
    gasStationUrl: 'https://gasstation.testnet.example',
    gasStationAuthToken: 'replace-with-token'
  }
};

const client = {} as IIotaClient;
const vaultConnector = {} as IVaultConnector;
const tx = Iota.createTransaction();

const gasReservation = await Iota.reserveGas(config, config.gasBudget ?? 50_000_000);
const txBytes = new Uint8Array([1, 2, 3, 4]);
const userSignature = 'base64-signature';

const sponsoredResult = await Iota.executeGasStationTransaction(
  config,
  gasReservation.reservationId,
  txBytes,
  userSignature
);

const finalResult: IIotaTransactionBlockResponse =
  await Iota.executeAndConfirmGasStationTransaction(
    config,
    client,
    gasReservation.reservationId,
    txBytes,
    userSignature,
    {
      waitForConfirmation: true
    }
  );

const postedResult = await Iota.prepareAndPostGasStationTransaction(
  config,
  vaultConnector,
  'deployer',
  client,
  '0xabc123',
  tx as IIotaTransaction
);

console.log(gasReservation.reservationId > 0); // true
console.log(sponsoredResult.confirmedLocalExecution); // true
console.log(typeof finalResult.digest === 'string'); // true
console.log(typeof postedResult.digest === 'string'); // true
```

```typescript
import { Iota, type IIotaClient, type IIotaConfig } from '@3sixty/dlt-iota';
import type { ILoggingComponent } from '@3sixty/logging-models';

const config: IIotaConfig = {
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  },
  inclusionTimeoutSeconds: 30
};

const client = {} as IIotaClient;
const tx = Iota.createTransaction();
const logging = {} as ILoggingComponent;

const packageExists = await Iota.packageExistsOnNetwork(client, '0x2');
const dryRun = await Iota.dryRunTransaction(client, logging, tx, '0xabc123', 'mint_token');
const isAbort = Iota.isAbortError(new Error('MoveAbort: abort code: 17'), 17);
const parsedError = Iota.extractPayloadError({ code: 'InsufficientGas' });

console.log(packageExists); // true
console.log(dryRun.status); // success
console.log(isAbort); // true
console.log(parsedError.name); // General
```

```typescript
import {
  Iota,
  type IIotaClient,
  type IIotaConfig,
  type IIotaTransactionBlockResponse
} from '@3sixty/dlt-iota';
import type { IVaultConnector } from '@3sixty/vault-models';

const config: IIotaConfig = {
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  },
  gasStation: {
    gasStationUrl: 'https://gasstation.testnet.example',
    gasStationAuthToken: 'replace-with-token'
  }
};

const client = {} as IIotaClient;
const vaultConnector = {} as IVaultConnector;

const transferResult: IIotaTransactionBlockResponse = await Iota.prepareAndPostValueTransaction(
  config,
  vaultConnector,
  undefined,
  'deployer',
  client,
  '0xabc123',
  5_000_000n,
  '0xdef456'
);

console.log(typeof transferResult.digest === 'string'); // true
```

## IotaSmartContractUtils

```typescript
import {
  IotaSmartContractUtils,
  NetworkTypes,
  type IIotaConfig,
  type ISmartContractDeployments
} from '@3sixty/dlt-iota';
import type { IotaClient } from '@iota/iota-sdk/client';
import type { ILoggingComponent } from '@3sixty/logging-models';
import type { IVaultConnector } from '@3sixty/vault-models';
import type { IWalletConnector } from '@3sixty/wallet-models';

const config: IIotaConfig = {
  network: NetworkTypes.Testnet,
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  },
  enableCostLogging: true
};

const deploymentConfig: ISmartContractDeployments = {
  testnet: {
    packageId: '0x111',
    deployedPackageId: '0x111',
    migrationStateId: '0x222',
    packageBytecode: 'base64'
  }
};

const client = {} as IotaClient;
const vaultConnector = {} as IVaultConnector;
const walletConnector = {} as IWalletConnector;
const logging = {} as ILoggingComponent;

await IotaSmartContractUtils.enableMigration(
  config,
  client,
  vaultConnector,
  walletConnector,
  logging,
  80_000_000,
  'controller',
  'nft',
  '0x111',
  deploymentConfig
);

await IotaSmartContractUtils.disableMigration(
  config,
  client,
  vaultConnector,
  walletConnector,
  logging,
  80_000_000,
  'controller',
  'nft',
  '0x111',
  deploymentConfig
);

console.log(IotaSmartContractUtils.CLASS_NAME); // IotaSmartContractUtils
```

```typescript
import {
  IotaSmartContractUtils,
  NetworkTypes,
  type IIotaConfig,
  type ISmartContractDeployments
} from '@3sixty/dlt-iota';
import type { IotaClient } from '@iota/iota-sdk/client';
import type { ILoggingComponent } from '@3sixty/logging-models';
import type { IVaultConnector } from '@3sixty/vault-models';
import type { IWalletConnector } from '@3sixty/wallet-models';

const config: IIotaConfig = {
  network: NetworkTypes.Testnet,
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  }
};

const deploymentConfig: ISmartContractDeployments = {
  testnet: {
    packageId: '0x111',
    deployedPackageId: '0x111',
    migrationStateId: '0x222',
    packageBytecode: 'base64'
  }
};

const client = {} as IotaClient;
const vaultConnector = {} as IVaultConnector;
const walletConnector = {} as IWalletConnector;
const logging = {} as ILoggingComponent;

await IotaSmartContractUtils.migrateSmartContract(
  config,
  client,
  vaultConnector,
  logging,
  90_000_000,
  'controller',
  '0x999',
  'nft',
  '0x111',
  deploymentConfig
);

const migrationActive = await IotaSmartContractUtils.isMigrationActive(
  config,
  client,
  'nft',
  '0x111',
  deploymentConfig,
  'controller',
  walletConnector
);

console.log(migrationActive); // true
```

```typescript
import { IotaSmartContractUtils, NetworkTypes, type IIotaConfig } from '@3sixty/dlt-iota';
import type { IotaClient } from '@iota/iota-sdk/client';
import type { IWalletConnector } from '@3sixty/wallet-models';

type ContractObjectFields = {
  fields: {
    version: string;
  };
};

const config: IIotaConfig = {
  network: NetworkTypes.Testnet,
  clientOptions: {
    url: 'https://api.testnet.iota.cafe'
  }
};

const client = {} as IotaClient;
const walletConnector = {} as IWalletConnector;

const currentVersion = await IotaSmartContractUtils.getCurrentContractVersion(
  config,
  client,
  'nft',
  '0x111',
  'controller',
  walletConnector
);

const isCompatible = await IotaSmartContractUtils.validateObjectVersion<ContractObjectFields>(
  config,
  client,
  'nft',
  '0x111',
  'controller',
  '0x777',
  walletConnector,
  content => Number(content.fields.version)
);

console.log(currentVersion >= 1); // true
console.log(isCompatible); // true
```
