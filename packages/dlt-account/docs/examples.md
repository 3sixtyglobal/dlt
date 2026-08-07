# DLT Account Examples

These examples show how to create, query, and manage distributed ledger accounts through a vault connector, covering the full lifecycle from creation to removal.

## AccountHelper

```typescript
import type { IVaultConnector } from '@twin.org/vault-models';
import { AccountHelper } from '@twin.org/dlt-account';

declare const vaultConnector: IVaultConnector;
const identity = 'did:example:alice';

// Generate a fresh mnemonic automatically, store it with its derived seed,
// and pre-cache the first chunk of BIP44 address keys for account index 0.
const mnemonic = await AccountHelper.createAccountKeys(undefined, vaultConnector, identity);

// Or import a known mnemonic for an existing account.
const existingMnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const stored = await AccountHelper.createAccountKeys(
  undefined,
  vaultConnector,
  'did:example:bob',
  existingMnemonic
);
console.log(stored === existingMnemonic); // true
```

```typescript
import type { IVaultConnector } from '@twin.org/vault-models';
import { AccountHelper } from '@twin.org/dlt-account';

declare const vaultConnector: IVaultConnector;
const identity = 'did:example:alice';

// Retrieve three consecutive external addresses starting at index 0.
const addresses = await AccountHelper.getAddresses(undefined, vaultConnector, identity, 0, 0, 3);
console.log(addresses.length); // 3

// Get a single external address at a known index.
const address = await AccountHelper.getAddress(undefined, vaultConnector, identity, 0, 0);
console.log(address === addresses[0]); // true

// Retrieve internal (change) addresses for account index 1.
const internalAddresses = await AccountHelper.getAddresses(
  undefined,
  vaultConnector,
  identity,
  1,
  0,
  5,
  true
);
console.log(internalAddresses.length); // 5
```

```typescript
import type { IVaultConnector } from '@twin.org/vault-models';
import { AccountHelper } from '@twin.org/dlt-account';

declare const vaultConnector: IVaultConnector;
const identity = 'did:example:alice';

// Generate addresses then find the vault key for a specific one.
const addresses = await AccountHelper.getAddresses(undefined, vaultConnector, identity, 0, 0, 5);
const { keyName, publicKey } = await AccountHelper.findAddressKey(
  undefined,
  vaultConnector,
  identity,
  addresses[2]
);
console.log(keyName); // "did:example:alice/account/0/0/2"
console.log(AccountHelper.publicKeyToAddress(publicKey) === addresses[2]); // true
```

```typescript
import type { IVaultConnector } from '@twin.org/vault-models';
import { AccountHelper } from '@twin.org/dlt-account';

declare const vaultConnector: IVaultConnector;

// Move all vault entries for an identity from one DID to another.
await AccountHelper.renameAccountKeys(
  undefined,
  vaultConnector,
  'did:example:old-identity',
  'did:example:new-identity'
);
```

```typescript
import type { IVaultConnector } from '@twin.org/vault-models';
import { AccountHelper } from '@twin.org/dlt-account';

declare const vaultConnector: IVaultConnector;
const identity = 'did:example:alice';

// Remove all vault entries for the identity: mnemonic, seed, and all derived keys.
await AccountHelper.removeAccountKeys(undefined, vaultConnector, identity);
```

```typescript
import { Converter } from '@twin.org/core';
import type { IVaultConnector } from '@twin.org/vault-models';
import { AccountHelper } from '@twin.org/dlt-account';

declare const vaultConnector: IVaultConnector;
const identity = 'did:example:alice';

// Retrieve the seed bytes, deriving from the mnemonic if not yet stored.
const seed = await AccountHelper.getSeed(undefined, vaultConnector, identity);
console.log(seed instanceof Uint8Array); // true

// Derive and cache a chunk of 25 public keys starting at address index 0.
const publicKeys = await AccountHelper.getPublicKeys(
  undefined,
  vaultConnector,
  identity,
  0,
  false,
  0,
  async () => seed
);
console.log(publicKeys.length); // 25

// Convert a base64-encoded public key to its on-chain hex address.
const derivedAddress = AccountHelper.publicKeyToAddress(Converter.base64ToBytes(publicKeys[0]));
console.log(derivedAddress.startsWith('0x')); // true
```

```typescript
import { AccountHelper } from '@twin.org/dlt-account';

const identity = 'did:example:alice';

// Build vault key names for secrets and derived address keys.
console.log(AccountHelper.buildSeedKey(identity)); // "did:example:alice/seed"
console.log(AccountHelper.buildMnemonicKey(identity)); // "did:example:alice/mnemonic"
console.log(AccountHelper.buildAddressKeyName(identity, 0, false, 7)); // "did:example:alice/account/0/0/7"
console.log(AccountHelper.buildAddressKeyName(identity, 1, true, 0)); // "did:example:alice/account/1/1/0"

// Override default key names via IAccountConfig.
console.log(AccountHelper.buildSeedKey(identity, 'deployment-seed')); // "did:example:alice/deployment-seed"
console.log(AccountHelper.buildMnemonicKey(identity, 'deployment-mnemonic')); // "did:example:alice/deployment-mnemonic"
```
