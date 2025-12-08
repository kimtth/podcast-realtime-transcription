param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$AcrName,
    [string]$ImageType = 'cpu',
    [string]$DockerUsername,
    [string]$DockerPassword
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$paramFile = Join-Path $scriptDir 'main.bicepparam'
$appName = 'podcast-app'
$imageName = "podcast-$ImageType"
$acrLoginServer = "$AcrName.azurecr.io"

if (-not $DockerUsername) {
    $DockerUsername = az acr credential show --name $AcrName --query "username" -o tsv
    $DockerPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv
}

Write-Host "Deploying Container App..." -ForegroundColor Cyan
$containerImage = "${acrLoginServer}/${imageName}:latest"
$deploymentName = "container-app-$(Get-Random -Maximum 10000)"
& az deployment group create `
    --resource-group $ResourceGroup `
    --name $deploymentName `
    --parameters $paramFile `
    --parameters `
      location=$Location `
      containerImage=$containerImage `
      acrLoginServer=$acrLoginServer `
      acrUsername=$DockerUsername `
      acrPassword=$DockerPassword

$fqdn = az containerapp show --name $appName --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "App URL: https://$fqdn" -ForegroundColor Green
