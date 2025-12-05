#!/bin/bash
# Azure Container Instances - Deployment Helper (CPU-only, GPU retired July 2025)
# Usage: ./deploy.sh <resource-group> <location> <acr-name> [docker-username] [docker-password]

set -e

if [ $# -lt 3 ]; then
    echo "Usage: $0 <resource-group> <location> <acr-name> [docker-username] [docker-password]"
    exit 1
fi

RG=$1
LOCATION=$2
ACR_NAME=$3
DOCKER_USER=${4:-}
DOCKER_PASS=${5:-}

CONTAINER_NAME="podcast-cpu"

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
    containerImage="${ACR_NAME}.azurecr.io/podcast-cpu:latest" \
    acrLoginServer="${ACR_NAME}.azurecr.io" \
    acrUsername="$DOCKER_USER" \
    acrPassword="$DOCKER_PASS"

# Get the FQDN
FQDN=$(az container show --resource-group "$RG" --name "$CONTAINER_NAME" --query "ipAddress.fqdn" -o tsv)
echo ""
echo "Frontend: http://$FQDN:3000"
echo "API: http://$FQDN:8000"

