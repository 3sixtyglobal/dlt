# TWIN DLT IOTA

This package provides utilities for integrating applications with IOTA distributed ledger capabilities, including client construction, transaction submission, sponsored transaction support, and smart contract migration helpers. It is intended for services that need a reliable and repeatable approach to ledger operations without rebuilding common primitives.

## Installation

```shell
npm install @twin.org/dlt-iota
```

## Docker

To perform testing of this component it may be necessary to launch a local instance of the gas station to communicate with.

```shell
docker run -d --name twin-gas-station-test -p 6379:6379 -p 9527:9527 -p 9184:9184 -e IOTA_NODE_URL="https://api.testnet.iota.cafe" -e GAS_STATION_AUTH="qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI=" twinfoundation/twin-gas-station-test:latest
```

## Examples

Usage of the APIs is shown in the examples [docs/examples.md](docs/examples.md)

## Reference

Detailed reference documentation for the API can be found in [docs/reference/index.md](docs/reference/index.md)

## Changelog

The changes between each version can be found in [docs/changelog.md](docs/changelog.md)
