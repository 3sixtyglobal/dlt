# TWIN Distributed Ledger

This monorepo brings together reusable ledger utilities and supporting tools for building, testing, and deploying distributed ledger workloads. The packages and applications are designed to work together so teams can move from integration code to deployment workflows with fewer bespoke steps.

The repository focuses on consistent operational patterns across environments, including account management, client interaction, contract lifecycle support, and command line tooling that helps automate repetitive delivery tasks.

## Packages

- [dlt-account](packages/dlt-account/README.md) - Account management utilities for distributed ledger operations.
- [dlt-iota](packages/dlt-iota/README.md) - IOTA distributed ledger utilities for clients, transactions, and contract operations.

## Apps

- [move-to-json](apps/move-to-json/README.md) - CLI for compiling Move contracts and preparing deployment JSON for IOTA networks.

## Contributing

To contribute to this package see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)
