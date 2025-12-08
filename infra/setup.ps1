param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$AcrName,
    [Parameter(Mandatory)] [string]$SpeechName,
    [switch]$BuildImages
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$commonBicep = Join-Path $scriptDir 'common.bicep'

Write-Host "Setting up shared resources..." -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Location: $Location"
Write-Host "ACR: $AcrName"
Write-Host "Speech: $SpeechName"

# Create resource group
& az group create --name $ResourceGroup --location $Location --output none

# Deploy shared resources (ACR + Speech Service)
& az deployment group create `
    --resource-group $ResourceGroup `
    --template-file $commonBicep `
    --parameters acrName=$AcrName speechServiceName=$SpeechName

# Get ACR credentials
$acrLoginServer = az acr show --name $AcrName --query "loginServer" -o tsv
$acrUsername = az acr credential show --name $AcrName --query "username" -o tsv
$acrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

# Get Speech Service endpoint
$speechEndpoint = az cognitiveservices account show --resource-group $ResourceGroup --name $SpeechName --query "properties.endpoint" -o tsv 2>$null

if ($BuildImages) {
    Write-Host "Building and pushing Docker images..." -ForegroundColor Cyan
    $dockerfileCpu = Join-Path $repoRoot 'Dockerfile.cpu'
    # $dockerfileGpu = Join-Path $repoRoot 'Dockerfile.gpu'
    & az acr build --registry $AcrName --image "podcast-cpu:latest" --file $dockerfileCpu $repoRoot --output none
    # & az acr build --registry $AcrName --image "podcast-gpu:latest" --file $dockerfileGpu $repoRoot --output none
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "Export if needed:" -ForegroundColor Yellow
Write-Host "  ACR_NAME=$AcrName"
Write-Host "  ACR_LOGIN_SERVER=$acrLoginServer"
Write-Host "  ACR_USERNAME=$acrUsername"
Write-Host "  ACR_PASSWORD=<hidden>"
Write-Host "  SPEECH_ENDPOINT=$speechEndpoint"
Write-Host ""