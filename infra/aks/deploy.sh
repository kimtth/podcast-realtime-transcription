#!/bin/bash
# Azure Kubernetes Service - Deployment Helper (GPU)
# Bicep deploys AKS cluster; this script handles kubectl operations
# Usage: ./deploy.sh <resource-group> <location> <cluster-name> <acr-name> [docker-username] [docker-password]

set -e

if [ $# -lt 4 ]; then
    echo "Usage: $0 <resource-group> <location> <cluster-name> <acr-name> [docker-username] [docker-password]"
    exit 1
fi

RG=$1
LOCATION=$2
CLUSTER_NAME=$3
ACR_NAME=$4
DOCKER_USER=${5:-}
DOCKER_PASS=${6:-}

# Get ACR credentials if not provided
if [ -z "$DOCKER_USER" ]; then
    DOCKER_USER=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)
    DOCKER_PASS=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
fi

# Deploy AKS cluster via Bicep
az deployment group create \
  --resource-group "$RG" \
  --template-file main.bicep \
  --parameters location="$LOCATION" clusterName="$CLUSTER_NAME"

# Get cluster credentials
az aks get-credentials --resource-group "$RG" --name "$CLUSTER_NAME" --overwrite-existing

# Create namespace and ACR secret (not supported by Bicep)
kubectl create namespace podcast --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret docker-registry acr-secret \
  --docker-server="${ACR_NAME}.azurecr.io" \
  --docker-username="$DOCKER_USER" \
  --docker-password="$DOCKER_PASS" \
  -n podcast --dry-run=client -o yaml | kubectl apply -f -

# Deploy app (substitute ACR image and apply)
ACR_IMAGE="${ACR_NAME}.azurecr.io/podcast-gpu:latest"
sed "s|\${ACR_IMAGE}|${ACR_IMAGE}|g" k8s-deployment.yaml | kubectl apply -f -

echo ""
echo "App URL: kubectl get svc podcast-service -n podcast"

