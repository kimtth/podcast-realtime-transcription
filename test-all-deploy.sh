#!/bin/bash
# Test all deployment methods (Container App, ACI, App Service, AKS)
# Usage: ./test-all.sh <resource-group> <location> <acr-name> <speech-name> [--build-images] [--target container-app|aci|app-service|aks|all]

set -e

[ $# -lt 4 ] && { echo "Usage: $0 <resource-group> <location> <acr-name> <speech-name> [--build-images] [--target container-app|aci|app-service|aks|all]"; exit 1; }

RG=$1
LOCATION=$2
ACR_NAME=$3
SPEECH_NAME=$4
BUILD_IMAGES=""
TARGET="all"

for arg in "${@:5}"; do
    case $arg in
        --build-images) BUILD_IMAGES="true" ;;
        --target) continue ;;
        container-app|aci|app-service|aks|all) TARGET="$arg" ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_deployment() {
    local deploy_type=$1
    echo ""
    echo "========================================"
    echo "Testing: $deploy_type"
    echo "========================================"
    
    case $deploy_type in
        container-app)
            bash "$SCRIPT_DIR/infra/container-app/deploy.sh" "$RG" "$LOCATION" "$ACR_NAME" "cpu"
            ;;
        aci)
            bash "$SCRIPT_DIR/infra/aci/deploy.sh" "$RG" "$LOCATION" "$ACR_NAME"
            ;;
        app-service)
            bash "$SCRIPT_DIR/infra/app-service/deploy.sh" "$RG" "$LOCATION" "podcast-app" "$ACR_NAME"
            ;;
        aks)
            bash "$SCRIPT_DIR/infra/aks/deploy.sh" "$RG" "$LOCATION" "podcast-aks" "$ACR_NAME"
            ;;
    esac
    
    echo ""
    echo "✓ $deploy_type deployment complete"
}

# Setup shared resources first
echo "========================================"
echo "Setting up shared resources..."
echo "========================================"
BUILD_FLAG=""
[ "$BUILD_IMAGES" = "true" ] && BUILD_FLAG="--build-images"
bash "$SCRIPT_DIR/infra/setup.sh" "$RG" "$LOCATION" "$ACR_NAME" "$SPEECH_NAME" $BUILD_FLAG

# Run selected deployment(s)
if [ "$TARGET" = "all" ]; then
    run_deployment "container-app"
    run_deployment "aci"
    run_deployment "app-service"
    run_deployment "aks"
else
    run_deployment "$TARGET"
fi

echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Resource Group: $RG"
echo "Location: $LOCATION"
echo "ACR: $ACR_NAME"
echo "Speech Service: $SPEECH_NAME"
echo "Target(s): $TARGET"
echo ""
echo "Cleanup with:"
echo "  ./infra/cleanup.sh $RG --force"
