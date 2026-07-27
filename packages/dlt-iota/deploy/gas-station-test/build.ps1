# Build script for TWIN Gas Station unified Docker image
# Supports multi-platform builds and publication to Docker Hub

$ErrorActionPreference = "Stop"

# Configuration
$IMAGE_NAME = "twin-gas-station-test"
$DOCKER_HUB_REPO = "twinfoundation/twin-gas-station-test"
$VERSION = "latest"
$PLATFORMS = "linux/amd64,linux/arm64"
$BUILDER_NAME = "twin-multiplatform-builder"

Write-Host "Building TWIN Gas Station unified Docker image..."

docker buildx version 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED Docker buildx is required. Install it from https://docs.docker.com/go/buildx/"
    exit 1
}

function Invoke-BuildxSetup {
    docker buildx version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED Docker buildx is required for multi-platform builds"
        Write-Host "Please install Docker buildx or use Docker Desktop"
        exit 1
    }

    $null = docker buildx inspect $BUILDER_NAME 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating new buildx builder: $BUILDER_NAME"
        docker buildx create --name $BUILDER_NAME --driver docker-container --driver-opt network=host
        Write-Host "Builder created successfully"
    } else {
        Write-Host "Builder $BUILDER_NAME already exists"
    }

    Write-Host "Switching to builder: $BUILDER_NAME"
    docker buildx use $BUILDER_NAME

    Write-Host "Checking builder capabilities..."
    docker buildx ls | Select-String $BUILDER_NAME
}

function Wait-ForService {
    param(
        [string]$ServiceName,
        [scriptblock]$CheckCommand,
        [int]$MaxAttempts = 60
    )

    Write-Host "Waiting for $ServiceName to be ready..."
    $attempt = 1

    while ($attempt -le $MaxAttempts) {
        try {
            & $CheckCommand 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "OK $ServiceName is ready (took ${attempt}s)"
                return $true
            }
        } catch {}

        if ($attempt % 5 -eq 0) {
            Write-Host "... Still waiting for $ServiceName... (${attempt}s elapsed)"
        }

        Start-Sleep -Seconds 1
        $attempt++
    }

    Write-Host "FAILED $ServiceName failed to start after ${MaxAttempts} seconds"
    return $false
}

function Build-Local {
    Write-Host "Building local image for testing..."
    docker buildx build --load -t "${IMAGE_NAME}:${VERSION}" .
    Write-Host "Local build completed: ${IMAGE_NAME}:${VERSION}"
}

function Build-Multiplatform {
    Write-Host "Building multi-platform image..."
    Write-Host "Platforms: $PLATFORMS"
    Write-Host "Repository: $DOCKER_HUB_REPO"

    $currentBuilder = (docker buildx inspect --bootstrap | Select-String "Name:").ToString().Split()[-1]
    Write-Host "Using builder: $currentBuilder"

    $dateTag = Get-Date -Format 'yyyyMMdd'
    Write-Host "Running build command..."
    docker buildx build `
        --platform $PLATFORMS `
        --tag "${DOCKER_HUB_REPO}:${VERSION}" `
        --tag "${DOCKER_HUB_REPO}:${dateTag}" `
        --push `
        .

    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK Multi-platform build and push completed successfully!"
        Write-Host "Available at: ${DOCKER_HUB_REPO}:${VERSION}"
        Write-Host "Daily tag: ${DOCKER_HUB_REPO}:${dateTag}"
    } else {
        Write-Host "FAILED Build failed. Check the error messages above."
        Write-Host ""
        Write-Host "Troubleshooting tips:"
        Write-Host "1. Make sure you're logged in: docker login"
        Write-Host "2. Check builder status: docker buildx ls"
        Write-Host "3. If using 'docker' driver, create new builder:"
        Write-Host "   docker buildx create --name twin-multiplatform-builder --driver docker-container"
        Write-Host "   docker buildx use twin-multiplatform-builder"
        exit 1
    }
}

function Test-Local {
    Write-Host "Testing local image..."

    # Stop any existing container
    docker stop twin-gas-station-test 2>$null
    docker rm twin-gas-station-test 2>$null

    docker image inspect "${IMAGE_NAME}:${VERSION}" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED Image '${IMAGE_NAME}:${VERSION}' not found. Run '.\build.ps1 local' first."
        return $false
    }

    Write-Host "Starting test container..."
    docker run -d `
        --name twin-gas-station-test `
        -p 6379:6379 `
        -p 9527:9527 `
        -p 9184:9184 `
        "${IMAGE_NAME}:${VERSION}"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED Container failed to start. Check the error above (e.g. a required port may already be in use)."
        Write-Host "On Windows, check excluded port ranges: netsh int ipv4 show excludedportrange protocol=tcp"
        return $false
    }

    $redisReady = Wait-ForService -ServiceName "Redis" -CheckCommand {
        docker exec twin-gas-station-test redis-cli ping
    }
    if (-not $redisReady) {
        Write-Host "FAILED Redis test failed"
        docker logs twin-gas-station-test
        return $false
    }

    $gasStationReady = Wait-ForService -ServiceName "Gas Station" -CheckCommand {
        docker exec twin-gas-station-test curl -f http://localhost:9527/
    }
    if (-not $gasStationReady) {
        Write-Host "FAILED Gas Station test failed"
        docker logs twin-gas-station-test
        return $false
    }

    Write-Host "OK All services are ready!"
    Write-Host ""

    Write-Host "Running final verification tests..."

    Write-Host "Testing Redis connection..."
    docker exec twin-gas-station-test redis-cli ping
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK Redis is working"
    } else {
        Write-Host "FAILED Redis verification failed"
        docker logs twin-gas-station-test
        return $false
    }

    Write-Host "Testing Gas Station connection..."
    docker exec twin-gas-station-test curl -f http://localhost:9527/ 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK Gas Station is working"
    } else {
        Write-Host "FAILED Gas Station verification failed"
        docker logs twin-gas-station-test
        return $false
    }

    Write-Host "OK All tests passed!"

    # Cleanup
    docker stop twin-gas-station-test
    docker rm twin-gas-station-test
    return $true
}

function Invoke-Setup {
    Write-Host "Setting up buildx builder for multi-platform builds..."

    Write-Host "Registering QEMU emulators for cross-architecture support..."
    docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: QEMU registration failed. This may affect cross-architecture builds."
        Write-Host "You might need to run Docker with --privileged or run as administrator."
    } else {
        Write-Host "OK QEMU emulators registered successfully"
    }

    $builderExists = docker buildx inspect $BUILDER_NAME 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating new buildx builder: $BUILDER_NAME"
        docker buildx create --name $BUILDER_NAME --driver docker-container --driver-opt network=host --use
    } else {
        Write-Host "Builder $BUILDER_NAME already exists, switching to it..."
        docker buildx use $BUILDER_NAME
    }

    Write-Host "Bootstrapping builder (this may take a few minutes)..."
    docker buildx inspect --bootstrap

    Write-Host ""
    Write-Host "OK Builder setup complete!"
    Write-Host "Current builders:"
    docker buildx ls
    Write-Host ""
    Write-Host "Supported platforms:"
    docker buildx inspect $BUILDER_NAME | Select-String "Platforms:"
    Write-Host ""
    Write-Host "You can now run: .\build.ps1 publish"
}

# Main script logic
switch ($args[0]) {
    "local" {
        Build-Local
    }
    "test" {
        Test-Local
    }
    "publish" {
        Invoke-BuildxSetup
        Build-Multiplatform
    }
    "setup" {
        Invoke-Setup
    }
    "all" {
        Build-Local
        Test-Local
        Write-Host "Local build and test successful. Ready for publishing."
        Write-Host "Run '.\build.ps1 publish' to build and push multi-platform image to Docker Hub"
    }
    default {
        Write-Host "Usage: .\build.ps1 {local|test|publish|all|setup}"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  local    - Build local image for testing"
        Write-Host "  test     - Test the local image"
        Write-Host "  publish  - Build and push multi-platform image to Docker Hub"
        Write-Host "  all      - Build local + test (recommended first step)"
        Write-Host "  setup    - Setup buildx builder for multi-platform builds"
        Write-Host ""
        Write-Host "Troubleshooting:"
        Write-Host "  If you get 'Multi-platform build is not supported' error:"
        Write-Host "  1. Run: .\build.ps1 setup (includes QEMU registration)"
        Write-Host "  2. Then: .\build.ps1 publish"
        Write-Host ""
        Write-Host "Manual setup (complete process):"
        Write-Host "  docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes"
        Write-Host "  docker buildx create --name twin-multiplatform-builder --driver docker-container --use"
        Write-Host "  docker buildx inspect --bootstrap"
        Write-Host ""
        Write-Host "Note: QEMU registration may require running PowerShell as Administrator"
        exit 1
    }
}
