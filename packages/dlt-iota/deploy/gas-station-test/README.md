# TWIN Gas Station Test Image

A single Docker image that runs both Redis and the IOTA Gas Station together, intended for local development and CI testing of the TWIN framework.

The image uses [supervisord](http://supervisord.org/) to start Redis first and then the Gas Station, with health checks to gate the startup sequence. Both services are accessible on mapped host ports.

## Services

| Service     | Port   | Description                         |
| ----------- | ------ | ----------------------------------- |
| Redis       | `6379` | Storage backend for the gas station |
| Gas Station | `9527` | IOTA gas station API                |
| Metrics     | `9184` | Gas station Prometheus metrics      |

## Credentials

The image ships with default credentials for local testing only. **These must be replaced for any shared or non-local deployment.**

| Variable              | Default value                                  | Description                                                  |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `GAS_STATION_AUTH`    | `qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI=` | Auth token clients use to access the gas station             |
| `GAS_STATION_KEYPAIR` | _(built-in test keypair)_                      | Ed25519 keypair used by the gas station to sign transactions |

Pass overrides at `docker run` time:

```bash
docker run -d \
  --name twin-gas-station-test \
  -p 6379:6379 \
  -p 9527:9527 \
  -p 9184:9184 \
  -e GAS_STATION_AUTH=<your-auth-token> \
  -e GAS_STATION_KEYPAIR=<your-base64-keypair> \
  twin-gas-station-test:latest
```

### Generating a new keypair

Use `generate-key-pair.mjs` to produce a fresh keypair:

```bash
node generate-key-pair.mjs
```

The script outputs:

- **Gas Station Private Key (Base64)** — use as `GAS_STATION_KEYPAIR`
- **Gas Station Public Key (Base64)** — for reference
- **Gas Station Address for Funding (Hex)** — the IOTA address that must be funded before the gas station can operate

Fund the address using the IOTA testnet faucet at <https://faucet.testnet.iota.cafe/>.

## Quick Start

### Linux / macOS (bash)

```bash
# Build the image
./build.sh local

# Run the container
docker run -d \
  --name twin-gas-station-test \
  -p 6379:6379 \
  -p 9527:9527 \
  -p 9184:9184 \
  twin-gas-station-test:latest

# View logs
docker logs twin-gas-station-test

# Stop and remove
docker stop twin-gas-station-test
docker rm twin-gas-station-test
```

### Windows (PowerShell)

```powershell
# Build the image
.\build.ps1 local

# Run the container
docker run -d `
  --name twin-gas-station-test `
  -p 6379:6379 `
  -p 9527:9527 `
  -p 9184:9184 `
  twin-gas-station-test:latest

# View logs
docker logs twin-gas-station-test

# Stop and remove
docker stop twin-gas-station-test
docker rm twin-gas-station-test
```

### Direct Docker Build

```bash
docker build -t twin-gas-station-test:latest .
```

## Build Scripts

`build.sh` (Linux / macOS) and `build.ps1` (Windows) expose the same commands:

| Command   | Description                                       |
| --------- | ------------------------------------------------- |
| `local`   | Build the image locally for testing               |
| `test`    | Build, run, verify services, then clean up        |
| `all`     | `local` + `test` combined                         |
| `publish` | Build multi-platform image and push to Docker Hub |
| `setup`   | Register QEMU emulators and create buildx builder |

> On Windows, replace `./build.sh` with `.\build.ps1`.

## Container Management

```bash
# Check service status inside the container
docker exec twin-gas-station-test supervisorctl status

# Tail logs for a specific service
docker exec twin-gas-station-test supervisorctl tail redis
docker exec twin-gas-station-test supervisorctl tail gas-station

# Restart a service
docker exec twin-gas-station-test supervisorctl restart gas-station

# Test Redis
docker exec twin-gas-station-test redis-cli ping

# Test Gas Station API
docker exec twin-gas-station-test curl -f http://localhost:9527/
```

## Data Persistence

Redis data is stored at `/data/redis` inside the container. To persist it across restarts, mount a volume:

```bash
docker run -d \
  --name twin-gas-station-test \
  -p 6379:6379 \
  -p 9527:9527 \
  -p 9184:9184 \
  -v twin-redis-data:/data/redis \
  twin-gas-station-test:latest
```

## Multi-Platform Builds

Publishing to Docker Hub requires a `docker-container` buildx builder. Use the `setup` command to configure one:

```bash
./build.sh setup   # Linux / macOS
.\build.ps1 setup  # Windows
```

Or run the steps manually:

```bash
# Register QEMU emulators (enables cross-architecture builds)
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes

# Create a docker-container builder and set it as active
docker buildx create --name twin-multiplatform-builder --driver docker-container --use

# Bootstrap it
docker buildx inspect --bootstrap
```

Then publish:

```bash
./build.sh publish
```

## Files

| File                      | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `Dockerfile`              | Image definition                               |
| `gas-station-config.yaml` | Gas station configuration                      |
| `redis.conf`              | Redis server configuration                     |
| `supervisord.conf`        | Process manager configuration                  |
| `entrypoint.sh`           | Container initialisation script                |
| `build.sh`                | Build and test automation (Linux / macOS)      |
| `build.ps1`               | Build and test automation (Windows PowerShell) |

## Troubleshooting

**`Multi-platform build is not supported for the docker driver`**

The default `docker` driver only builds for the host architecture. Run `./build.sh setup` (or `.\build.ps1 setup` on Windows) to create a `docker-container` builder, then retry `publish`.

**Verify builder status:**

```bash
docker buildx ls
# twin-multiplatform-builder*  docker-container  running  linux/amd64*, linux/arm64*
```
