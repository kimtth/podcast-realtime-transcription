#!/bin/bash
# Setup all shared resources (ACR, Speech Service, and build images)
# Usage: ./setup.sh <resource-group> <location> <acr-name> <speech-name> [--build-images]

set -e

[ $# -lt 4 ] && { echo "Usage: $0 <resource-group> <location> <acr-name> <speech-name> [--build-images]"; exit 1; }

RG=$1
LOCATION=$2
ACR_NAME=$3
SPEECH_NAME=$4
BUILD_IMAGES=""

for arg in "${@:5}"; do
    case $arg in
        --build-images) BUILD_IMAGES="true" ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up shared resources..."
echo "Resource Group: $RG"
echo "Location: $LOCATION"
echo "ACR: $ACR_NAME"
echo ""

# Create resource group
az group create --name "$RG" --location "$LOCATION" -o none 2>/dev/null || true

# Deploy shared resources (ACR + Speech Service) via Bicep
echo "Deploying ACR and Speech Service..."
az deployment group create \
  --resource-group "$RG" \
  --template-file "common.bicep" \
  --parameters acrName="$ACR_NAME" speechServiceName="$SPEECH_NAME"

# Get ACR credentials
LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query "loginServer" -o tsv)
USERNAME=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)
PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# Get Speech Service endpoint
SPEECH_ENDPOINT=$(az cognitiveservices account show --resource-group "$RG" --name "$SPEECH_NAME" --query "properties.endpoint" -o tsv 2>/dev/null)

# Build and push images if requested
if [ "$BUILD_IMAGES" = "true" ]; then
    echo "Building and pushing Docker images..."
    az acr build --registry "$ACR_NAME" --image "podcast-cpu:latest" --file "Dockerfile.cpu" . -o none
    az acr build --registry "$ACR_NAME" --image "podcast-gpu:latest" --file "Dockerfile.gpu" . -o none
    cd "$SCRIPT_DIR"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Export these for deployments:"
echo "export ACR_NAME=$ACR_NAME"
echo "export ACR_LOGIN_SERVER=$LOGIN_SERVER"
echo "export ACR_USERNAME=$USERNAME"
echo "export ACR_PASSWORD=$PASSWORD"
echo "export SPEECH_ENDPOINT=$SPEECH_ENDPOINT"
echo ""
echo "Deploy with:"
echo "  ./infra/container-app/deploy.sh $RG $LOCATION $ACR_NAME cpu"
echo "  ./infra/aci/deploy.sh $RG $LOCATION $ACR_NAME"
echo "  ./infra/app-service/deploy.sh $RG $LOCATION podcast-app $ACR_NAME"
echo "  ./infra/aks/deploy.sh $RG $LOCATION podcast-aks $ACR_NAME"
echo ""
echo "Cleanup:"
echo "  ./infra/cleanup.sh $RG --force"
