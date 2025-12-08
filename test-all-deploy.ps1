param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$AcrName,
    [Parameter(Mandatory)] [string]$SpeechName,
    [ValidateSet('container-app','aci','app-service','aks','all')] [string]$Target = 'all',
    [switch]$BuildImages
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$infraDir = Join-Path $scriptDir 'infra'
$repoRoot = $scriptDir

function Get-AcrCredentials {
    param([string]$Name)
    [pscustomobject]@{
        LoginServer = az acr show --name $Name --query "loginServer" -o tsv
        Username    = az acr credential show --name $Name --query "username" -o tsv
        Password    = az acr credential show --name $Name --query "passwords[0].value" -o tsv
    }
}

function Run-Setup {
    Write-Host "Setting up shared resources..." -ForegroundColor Cyan
    & (Join-Path $infraDir 'setup.ps1') -ResourceGroup $ResourceGroup -Location $Location -AcrName $AcrName -SpeechName $SpeechName -BuildImages:$BuildImages
}

function Deploy-ContainerApp {
    param([pscustomobject]$Creds)
    Write-Host "Deploying Container App..." -ForegroundColor Cyan
    $imageName = "podcast-cpu"
    $containerImage = "$($Creds.LoginServer)/$imageName`:latest"
    $deploymentName = "container-app-$(Get-Random -Maximum 10000)"
    & az deployment group create `
        --resource-group $ResourceGroup `
        --name $deploymentName `
        --template-file (Join-Path $infraDir 'container-app/main.bicep') `
        --parameters (Join-Path $infraDir 'container-app/main.bicepparam') `
        --parameters `
          location=$Location `
          containerImage=$containerImage `
          acrLoginServer=$($Creds.LoginServer) `
          acrUsername=$($Creds.Username) `
          acrPassword=$($Creds.Password)
    $fqdn = az containerapp show --name 'podcast-app' --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
    Write-Host "Container App URL: https://$fqdn" -ForegroundColor Green
}

function Deploy-Aci {
    param([pscustomobject]$Creds)
    Write-Host "Deploying ACI..." -ForegroundColor Cyan
    $imageName = "podcast-cpu"
    $containerImage = "$($Creds.LoginServer)/$imageName`:latest"
    $deploymentName = "aci-$(Get-Random -Maximum 10000)"
    & az deployment group create `
        --resource-group $ResourceGroup `
        --name $deploymentName `
        --template-file (Join-Path $infraDir 'aci/main.bicep') `
        --parameters (Join-Path $infraDir 'aci/main.bicepparam') `
        --parameters `
          location=$Location `
          containerImage=$containerImage `
          acrLoginServer=$($Creds.LoginServer) `
          acrUsername=$($Creds.Username) `
          acrPassword=$($Creds.Password)
    $fqdn = az container show --resource-group $ResourceGroup --name 'podcast-cpu' --query "ipAddress.fqdn" -o tsv
    Write-Host "ACI Frontend: http://$fqdn:3000" -ForegroundColor Green
    Write-Host "ACI API: http://$fqdn:8000" -ForegroundColor Green
}

function Deploy-AppService {
    param([pscustomobject]$Creds)
    Write-Host "Deploying App Service..." -ForegroundColor Cyan
    $appName = "podcast-app-svc"
    $imageName = "podcast-cpu"
    $containerImage = "$($Creds.LoginServer)/$imageName`:latest"
    $deploymentName = "app-service-$(Get-Random -Maximum 10000)"
    & az deployment group create `
        --resource-group $ResourceGroup `
        --name $deploymentName `
        --template-file (Join-Path $infraDir 'app-service/main.bicep') `
        --parameters (Join-Path $infraDir 'app-service/main.bicepparam') `
        --parameters `
          location=$Location `
          appName=$appName `
          containerImage=$containerImage `
          acrLoginServer=$($Creds.LoginServer) `
          acrUsername=$($Creds.Username) `
          acrPassword=$($Creds.Password)
    Write-Host "App Service URL: https://$appName.azurewebsites.net" -ForegroundColor Green
}

function Deploy-Aks {
    param([pscustomobject]$Creds)
    Write-Host "Deploying AKS (CPU-only; GPU nodes removed)..." -ForegroundColor Cyan
    $clusterName = "podcast-aks-$(Get-Random -Maximum 10000)"
    $imageName = "podcast-cpu"
    $acrImage = "$($Creds.LoginServer)/$imageName`:latest"
    $k8sTemplate = Join-Path $infraDir 'aks/k8s-deployment.yaml'
    $deploymentName = "aks-$(Get-Random -Maximum 10000)"
    & az deployment group create `
        --resource-group $ResourceGroup `
        --name $deploymentName `
        --template-file (Join-Path $infraDir 'aks/main.bicep') `
        --parameters (Join-Path $infraDir 'aks/main.bicepparam') `
        --parameters location=$Location clusterName=$clusterName

    & az aks get-credentials --resource-group $ResourceGroup --name $clusterName --overwrite-existing

    & kubectl create namespace podcast --dry-run=client -o yaml | kubectl apply -f -
    & kubectl create secret docker-registry acr-secret `
        --docker-server=$($Creds.LoginServer) `
        --docker-username=$($Creds.Username) `
        --docker-password=$($Creds.Password) `
        -n podcast --dry-run=client -o yaml | kubectl apply -f -

    (Get-Content $k8sTemplate) -replace '\$\{ACR_IMAGE\}', $acrImage | kubectl apply -f -
    Write-Host "AKS deployment applied. Check service via: kubectl get svc podcast-service -n podcast" -ForegroundColor Green
}

Run-Setup
$creds = Get-AcrCredentials -Name $AcrName

if ($Target -eq 'all') {
    Deploy-ContainerApp -Creds $creds
    Deploy-Aci -Creds $creds
    Deploy-AppService -Creds $creds
    Deploy-Aks -Creds $creds
} else {
    switch ($Target) {
        'container-app' { Deploy-ContainerApp -Creds $creds }
        'aci'           { Deploy-Aci -Creds $creds }
        'app-service'   { Deploy-AppService -Creds $creds }
        'aks'           { Deploy-Aks -Creds $creds }
    }
}

Write-Host "`nTest Summary" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Location: $Location"
Write-Host "ACR: $AcrName"
Write-Host "Speech Service: $SpeechName"
Write-Host "Target(s): $Target"
Write-Host "Cleanup with: ./infra/cleanup.sh $ResourceGroup --force"