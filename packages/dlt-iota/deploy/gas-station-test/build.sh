#!/bin/bash
# Build script for TWIN Gas Station unified Docker image
# Supports multi-platform builds and publication to Docker Hub

set -e

# Configuration
IMAGE_NAME="twin-gas-station-test"
DOCKER_HUB_REPO="martynjanesiota/twin-gas-station-test"
VERSION="latest"
PLATFORMS="linux/amd64,linux/arm64"
BUILDER_NAME="twin-multiplatform-builder"

echo "Building TWIN Gas Station unified Docker image..."

if ! docker buildx version > /dev/null 2>&1; then
    echo "❌ Docker buildx is required. Install it from https://docs.docker.com/go/buildx/"
    exit 1
fi

# Function to wait for a service to be ready
wait_for_service() {
    local service_name="$1"
    local check_command="$2"
    local max_attempts=60
    local attempt=1

    echo "Waiting for $service_name to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            echo "✅ $service_name is ready (took ${attempt}s)"
            return 0
        fi

        if [ $((attempt % 5)) -eq 0 ]; then
            echo "⏳ Still waiting for $service_name... (${attempt}s elapsed)"
        fi

        sleep 1
        ((attempt++))
    done

    echo "❌ $service_name failed to start after ${max_attempts} seconds"
    return 1
}

# Function to ensure buildx builder is ready (publish/setup only)
setup_builder() {
    if ! docker buildx version > /dev/null 2>&1; then
        echo "❌ Docker buildx is required for multi-platform builds"
        echo "Please install Docker buildx or use Docker Desktop"
        exit 1
    fi

    if ! docker buildx inspect "$BUILDER_NAME" > /dev/null 2>&1; then
        echo "Creating new buildx builder: $BUILDER_NAME"
        docker buildx create --name "$BUILDER_NAME" --driver docker-container --driver-opt network=host
    else
        echo "Builder $BUILDER_NAME already exists"
    fi

    echo "Switching to builder: $BUILDER_NAME"
    docker buildx use "$BUILDER_NAME"

    echo "Checking builder capabilities..."
    docker buildx ls | grep "$BUILDER_NAME"
}

# Function to build locally for testing
build_local() {
    echo "Building local image for testing..."
    docker buildx build --load -t "$IMAGE_NAME:$VERSION" .
    echo "Local build completed: $IMAGE_NAME:$VERSION"
}

# Function to build and push multi-platform image
build_multiplatform() {
    echo "Building multi-platform image..."
    echo "Platforms: $PLATFORMS"
    echo "Repository: $DOCKER_HUB_REPO"

    CURRENT_BUILDER=$(docker buildx inspect --bootstrap | grep "Name:" | awk '{print $2}')
    echo "Using builder: $CURRENT_BUILDER"

    docker buildx build \
        --platform $PLATFORMS \
        --tag "$DOCKER_HUB_REPO:$VERSION" \
        --tag "$DOCKER_HUB_REPO:$(date +%Y%m%d)" \
        --push \
        .

    if [ $? -eq 0 ]; then
        echo "✅ Multi-platform build and push completed successfully!"
        echo "Available at: $DOCKER_HUB_REPO:$VERSION"
        echo "Daily tag: $DOCKER_HUB_REPO:$(date +%Y%m%d)"
    else
        echo "❌ Build failed. Check the error messages above."
        echo ""
        echo "Troubleshooting tips:"
        echo "1. Make sure you're logged in: docker login"
        echo "2. Check builder status: docker buildx ls"
        echo "3. If using 'docker' driver, create new builder:"
        echo "   docker buildx create --name $BUILDER_NAME --driver docker-container"
        echo "   docker buildx use $BUILDER_NAME"
        exit 1
    fi
}

# Function to test the local image
test_local() {
    echo "Testing local image..."

    docker stop twin-gas-station-test 2>/dev/null || true
    docker rm twin-gas-station-test 2>/dev/null || true

    if ! docker image inspect "$IMAGE_NAME:$VERSION" > /dev/null 2>&1; then
        echo "❌ Image '$IMAGE_NAME:$VERSION' not found. Run './build.sh local' first."
        return 1
    fi

    echo "Starting test container..."
    docker run -d \
        --name twin-gas-station-test \
        -p 6379:6379 \
        -p 9527:9527 \
        -p 9184:9184 \
        "$IMAGE_NAME:$VERSION"

    if [ $? -ne 0 ]; then
        echo "❌ Container failed to start. Check the error above (e.g. a required port may already be in use)."
        return 1
    fi

    if ! wait_for_service "Redis" "docker exec twin-gas-station-test redis-cli ping"; then
        echo "❌ Redis test failed"
        docker logs twin-gas-station-test
        return 1
    fi

    if ! wait_for_service "Gas Station" "docker exec twin-gas-station-test curl -f http://localhost:9527/"; then
        echo "❌ Gas Station test failed"
        docker logs twin-gas-station-test
        return 1
    fi

    echo "✅ All services are ready!"
    echo ""
    echo "Running final verification tests..."

    echo "Testing Redis connection..."
    if docker exec twin-gas-station-test redis-cli ping; then
        echo "✅ Redis is working"
    else
        echo "❌ Redis verification failed"
        docker logs twin-gas-station-test
        return 1
    fi

    echo "Testing Gas Station connection..."
    if docker exec twin-gas-station-test curl -f http://localhost:9527/ 2>/dev/null; then
        echo "✅ Gas Station is working"
    else
        echo "❌ Gas Station verification failed"
        docker logs twin-gas-station-test
        return 1
    fi

    echo "✅ All tests passed!"

    docker stop twin-gas-station-test
    docker rm twin-gas-station-test
}

# Main script logic
case "$1" in
    "local")
        build_local
        ;;
    "test")
        test_local
        ;;
    "publish")
        setup_builder
        build_multiplatform
        ;;
    "setup")
        echo "Setting up buildx builder for multi-platform builds..."

        echo "Registering QEMU emulators for cross-architecture support..."
        docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes

        if [ $? -ne 0 ]; then
            echo "⚠️  Warning: QEMU registration failed. This may affect cross-architecture builds."
        else
            echo "✅ QEMU emulators registered successfully"
        fi

        if ! docker buildx version > /dev/null 2>&1; then
            echo "❌ Docker buildx is required. Please install Docker buildx or use Docker Desktop"
            exit 1
        fi

        if ! docker buildx inspect "$BUILDER_NAME" > /dev/null 2>&1; then
            echo "Creating new buildx builder: $BUILDER_NAME"
            docker buildx create --name "$BUILDER_NAME" --driver docker-container --driver-opt network=host --use
        else
            echo "Builder $BUILDER_NAME already exists, switching to it..."
            docker buildx use "$BUILDER_NAME"
        fi

        echo "Bootstrapping builder (this may take a few minutes)..."
        docker buildx inspect --bootstrap

        echo ""
        echo "✅ Builder setup complete!"
        echo "Current builders:"
        docker buildx ls
        echo ""
        echo "Supported platforms:"
        docker buildx inspect "$BUILDER_NAME" | grep "Platforms:"
        echo ""
        echo "You can now run: ./build.sh publish"
        ;;
    "all")
        build_local
        test_local
        echo "Local build and test successful. Ready for publishing."
        echo "Run './build.sh publish' to build and push multi-platform image to Docker Hub"
        ;;
    *)
        echo "Usage: $0 {local|test|publish|all|setup}"
        echo ""
        echo "Commands:"
        echo "  local    - Build local image for testing"
        echo "  test     - Test the local image"
        echo "  publish  - Build and push multi-platform image to Docker Hub"
        echo "  all      - Build local + test (recommended first step)"
        echo "  setup    - Setup buildx builder for multi-platform builds"
        echo ""
        echo "Note: local and test do not require buildx."
        echo "      publish requires buildx — run setup first if needed."
        exit 1
        ;;
esac
