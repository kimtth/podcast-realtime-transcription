#!/bin/bash
# Azure Container App - Deployment Helper
# Usage: ./deploy.sh <resource-group> <location> <acr-name> <image-type> [docker-username] [docker-password]

set -e

if [ $# -lt 4 ]; then
    echo "Usage: $0 <resource-group> <location> <acr-name> <image-type> [docker-username] [docker-password]"
    exit 1
fi

RG=$1
LOCATION=$2
ACR_NAME=$3
IMAGE_TYPE=$4
DOCKER_USER=${5:-}
DOCKER_PASS=${6:-}

APP_NAME="podcast-app"
IMAGE_NAME="podcast-${IMAGE_TYPE}"

# Get ACR credentials if not provided
if [ -z "$DOCKER_USER" ]; then
    DOCKER_USER=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)
    DOCKER_PASS=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
fi

# Deploy via Bicep
az deployment group create \
  --resource-group "$RG" \
  --template-file main.bicep \
  --parameters \
    location="$LOCATION" \
    containerImage="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest" \
    acrLoginServer="${ACR_NAME}.azurecr.io" \
    acrUsername="$DOCKER_USER" \
    acrPassword="$DOCKER_PASS"

# Get the FQDN
FQDN=$(az containerapp show --name "$APP_NAME" --resource-group "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
echo ""
echo "App URL: https://$FQDN"

