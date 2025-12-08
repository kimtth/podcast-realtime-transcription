param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$AcrName,
    [string]$DockerUsername,
    [string]$DockerPassword
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$paramFile = Join-Path $scriptDir 'main.bicepparam'
$containerName = 'podcast-cpu'
$acrLoginServer = "$AcrName.azurecr.io"

if (-not $DockerUsername) {
    $DockerUsername = az acr credential show --name $AcrName --query "username" -o tsv
    $DockerPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv
}

Write-Host "Deploying ACI..." -ForegroundColor Cyan
$containerImage = "${acrLoginServer}/podcast-cpu:latest"
$deploymentName = "aci-$(Get-Random -Maximum 10000)"
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

$fqdn = az container show --resource-group $ResourceGroup --name $containerName --query "ipAddress.fqdn" -o tsv
Write-Host "Frontend: http://$fqdn:3000" -ForegroundColor Green
Write-Host "API: http://$fqdn:8000" -ForegroundColor Green
