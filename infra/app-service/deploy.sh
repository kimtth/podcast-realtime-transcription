#!/bin/bash
# Azure App Service - Deployment Helper (CPU-Only)
# Usage: ./deploy.sh <resource-group> <location> <app-name> <acr-name> [docker-username] [docker-password]

set -e

if [ $# -lt 4 ]; then
    echo "Usage: $0 <resource-group> <location> <app-name> <acr-name> [docker-username] [docker-password]"
    exit 1
fi

RG=$1
LOCATION=$2
APP_NAME=$3
ACR_NAME=$4
DOCKER_USER=${5:-}
DOCKER_PASS=${6:-}

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
    appName="$APP_NAME" \
    containerImage="${ACR_NAME}.azurecr.io/podcast-cpu:latest" \
    acrLoginServer="${ACR_NAME}.azurecr.io" \
    acrUsername="$DOCKER_USER" \
    acrPassword="$DOCKER_PASS"

echo ""
echo "App URL: https://${APP_NAME}.azurewebsites.net"

