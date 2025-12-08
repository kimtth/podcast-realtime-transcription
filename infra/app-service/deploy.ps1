param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$AppName,
    [Parameter(Mandatory)] [string]$AcrName,
    [string]$DockerUsername,
    [string]$DockerPassword
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$paramFile = Join-Path $scriptDir 'main.bicepparam'
$acrLoginServer = "$AcrName.azurecr.io"

if (-not $DockerUsername) {
    $DockerUsername = az acr credential show --name $AcrName --query "username" -o tsv
    $DockerPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv
}

Write-Host "Deploying App Service..." -ForegroundColor Cyan
$containerImage = "${acrLoginServer}/podcast-cpu:latest"
$deploymentName = "app-service-$(Get-Random -Maximum 10000)"
& az deployment group create `
    --resource-group $ResourceGroup `
    --name $deploymentName `
    --parameters $paramFile `
    --parameters `
      location=$Location `
      appName=$AppName `
      containerImage=$containerImage `
      acrLoginServer=$acrLoginServer `
      acrUsername=$DockerUsername `
      acrPassword=$DockerPassword

Write-Host "App URL: https://$AppName.azurewebsites.net" -ForegroundColor Green
