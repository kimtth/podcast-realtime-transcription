#!/bin/bash
# Cleanup Azure resources (delete resource group)
# Usage: ./cleanup.sh <resource-group> [--force]

set -e

[ $# -lt 1 ] && { echo "Usage: $0 <resource-group> [--force]"; exit 1; }

RG=$1
FORCE="false"

for arg in "${@:2}"; do
    case $arg in
        --force) FORCE="true" ;;
    esac
done

if [ "$FORCE" != "true" ]; then
    echo "Resources in resource group '$RG':"
    az resource list --resource-group "$RG" --query "[].{Name:name, Type:type}" -o table
    echo ""
    read -p "Delete all resources in '$RG'? (yes/no): " confirm
    [ "$confirm" = "yes" ] || exit 0
fi

echo "Deleting resource group '$RG'..."
az group delete --name "$RG" --yes --no-wait
echo "Resource group deletion initiated (running in background)"
