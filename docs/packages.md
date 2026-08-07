# Distributed Ledger Packages

## dlt-account

This package provides helper utilities for managing distributed ledger accounts. It covers the full account lifecycle against a vault connector, including BIP44 key derivation, secure storage of mnemonics and seeds, address generation, and account migration operations. It is intended for services that need consistent, repeatable account management without reimplementing common cryptographic patterns.

- [README](../packages/dlt-account/README.md)
- [Examples](../packages/dlt-account/docs/examples.md)
- [Changelog](../packages/dlt-account/docs/changelog.md)

## dlt-iota

This package provides practical utilities for working with IOTA distributed ledger operations, including client setup, transaction preparation, sponsored execution flows, and smart contract migration helpers. It is intended to reduce implementation overhead for services that need dependable interaction with IOTA networks while keeping integration patterns consistent across environments. For broader platform context, see the [IOTA documentation](https://docs.iota.org/).

- [README](../packages/dlt-iota/README.md)
- [Examples](../packages/dlt-iota/docs/examples.md)
- [Changelog](../packages/dlt-iota/docs/changelog.md)
