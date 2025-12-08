param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$ClusterName,
    [Parameter(Mandatory)] [string]$AcrName,
    [string]$DockerUsername,
    [string]$DockerPassword
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$paramFile = Join-Path $scriptDir 'main.bicepparam'
$k8sTemplate = Join-Path $scriptDir 'k8s-deployment.yaml'
$acrLoginServer = "$AcrName.azurecr.io"
$acrImage = "${acrLoginServer}/podcast-cpu:latest"

if (-not $DockerUsername) {
    $DockerUsername = az acr credential show --name $AcrName --query "username" -o tsv
    $DockerPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv
}

Write-Host "Deploying AKS (CPU-only; GPU nodes removed)..." -ForegroundColor Cyan
$deploymentName = "aks-$(Get-Random -Maximum 10000)"
& az deployment group create `
    --resource-group $ResourceGroup `
    --name $deploymentName `
    --parameters $paramFile `
    --parameters location=$Location clusterName=$ClusterName

& az aks get-credentials --resource-group $ResourceGroup --name $ClusterName --overwrite-existing

& kubectl create namespace podcast --dry-run=client -o yaml | kubectl apply -f -
& kubectl create secret docker-registry acr-secret `
    --docker-server=$acrLoginServer `
    --docker-username=$DockerUsername `
    --docker-password=$DockerPassword `
    -n podcast --dry-run=client -o yaml | kubectl apply -f -

(Get-Content $k8sTemplate) -replace '\${ACR_IMAGE}', $acrImage | kubectl apply -f -
Write-Host "AKS deployment applied. Check service via: kubectl get svc podcast-service -n podcast" -ForegroundColor Green
