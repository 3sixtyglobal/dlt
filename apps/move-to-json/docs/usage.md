# Move to JSON Usage

Use these commands to build and deploy Move contracts with a repeatable workflow across testnet, devnet, and mainnet.

## Running

To install and run the CLI locally use the following commands:

```shell
npm install @twin.org/move-to-json -g
move-to-json
```

or run directly using NPX:

```shell
npx "@twin.org/move-to-json"
```

## Help

```text
⚙️  TWIN Move to JSON v0.0.3-next.5

Usage: move-to-json

Options:
  -V, --version                output the version number
  --lang <lang>                The language to display the output in. (default: "en")
  --load-env [env...]          Load the env files to initialise any environment variables.
  -h, --help                   display help for command

Commands:
  build [options] <inputGlob>  Compiles Move smart contracts using the IOTA CLI and generates a network-aware JSON structure containing compiled bytecode modules.
  deploy [options]             Deploys previously compiled Move contracts to the specified IOTA network using the configured environment.
  help [command]               display help for command
```

## Build Command Output

```text
⚙️  TWIN Move to JSON v0.0.3-next.5

Usage: move-to-json build [options] <inputGlob>

Compiles Move smart contracts using the IOTA CLI and generates a network-aware JSON structure containing compiled bytecode modules.

Arguments:
  inputGlob            A glob pattern that matches one or more Move files

Options:
  --network <network>  Target network (testnet/devnet/mainnet) (default: "!NETWORK")
  --output <file>      Output file for compiled modules JSON (default: "smart-contract-deployments.json")
  -h, --help           display help for command
```

## Deploy Command Output

```text
⚙️  TWIN Move to JSON v0.0.3-next.5

Usage: move-to-json deploy [options]

Deploys previously compiled Move contracts to the specified IOTA network using the configured environment.

Options:
  --contracts <path>               Path to compiled contracts file (default: "smart-contract-deployments.json")
  -n, --network <network>          Target network (testnet, devnet, mainnet) (default: "!NETWORK")
  --dry-run                        Perform a dry run without actual deployment
  -f, --force                      Force redeployment even if already deployed
  --rpc-url <url>                  RPC endpoint URL for the network (default: "!RPC_URL")
  --address-index <number>         Address index for key derivation (default: "!ADDRESS_INDEX")
  --rpc-timeout <number>           RPC request timeout in milliseconds (default: "!RPC_TIMEOUT")
  --gas-budget <number>            Gas budget for transactions (default: "!GAS_BUDGET")
  --confirmation-timeout <number>  Transaction confirmation timeout in milliseconds (default: "!CONFIRMATION_TIMEOUT")
  --faucet-url <url>               Faucet URL for requesting test tokens (default: "!FAUCET_URL")
  --deployer-mnemonic <mnemonic>   Deployer wallet mnemonic phrase (default: "!DEPLOYER_MNEMONIC")
  --deployer-seed <seed>           Deployer wallet seed (alternative to mnemonic) (default: "!DEPLOYER_SEED")
  -h, --help                       display help for command
```

## Command Structure

The tool provides two core subcommands:

- `build` compiles Move contracts and generates a network-aware JSON structure.
- `deploy` deploys compiled contracts to a target network using your configured environment.

## Build Command

### Build Basic Usage

```shell
move-to-json build "src/contracts/**/*.move" --network testnet --output smart-contract-deployments.json
```

### What it does

- Finds matching `.move` files using your glob pattern.
- Compiles contracts with the IOTA CLI.
- Computes deterministic package IDs from compiled bytecode.
- Writes network-aware contract data for deployment.

### Example Output Structure

```json
{
  "testnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ..."
  },
  "devnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ..."
  },
  "mainnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ..."
  }
}
```

## Deploy Command

### Deploy Basic Usage

```shell
move-to-json deploy --network testnet --contracts <PATH-TO-CONTRACTS> --load-env <PATH-TO-ENVS>
move-to-json deploy --network mainnet --force --contracts <PATH-TO-CONTRACTS> --load-env <PATH-TO-ENVS>
move-to-json deploy --network testnet --dry-run --contracts <PATH-TO-CONTRACTS> --load-env <PATH-TO-ENVS>
```

### What the deploy command does

1. Prepares and validates the environment for the selected network.
2. Loads and validates deployment configuration.
3. Publishes contracts with the configured gas budget.
4. Updates contract JSON with deployed package IDs.

## Complete Workflow Example

```shell
# 1. Build contracts for testnet
move-to-json build "src/contracts/**/*.move" --network testnet --output src/contracts/smart-contract-deployments.json

# 2. Deploy to testnet
move-to-json deploy --network testnet --contracts <PATH-TO-CONTRACTS> --load-env <PATH-TO-ENVS>

# 3. Validate on testnet

# 4. Build contracts for mainnet
move-to-json build "src/contracts/**/*.move" --network mainnet --output src/contracts/smart-contract-deployments.json

# 5. Deploy to mainnet
move-to-json deploy --network mainnet --contracts <PATH-TO-CONTRACTS> --load-env <PATH-TO-ENVS>
```

## Security Considerations

- Mainnet deployments need careful gas and credential handling.
- Store wallet credentials in environment variables and secure secret stores.
- Use dry-run mode before live deployment.
- Test and verify on testnet before mainnet rollouts.

## Example

```shell
npx "@twin.org/move-to-json" build "tests/fixtures/sources/**/*.move" --load-env configs/testnet.env --output tests/fixtures/smart-contract-deployments/smart-contract-deployments.json
npx "@twin.org/move-to-json" deploy --load-env configs/testnet.env --contracts tests/fixtures/smart-contract-deployments/smart-contract-deployments.json --dry-run
```
