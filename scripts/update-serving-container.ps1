param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$AcrName,
    [ValidateSet('container-app','app-service','aci','aks')] [string]$Target = 'container-app',
    [string]$ContainerAppName = 'podcast-app',
    [string]$AppServiceName = 'podcast-app-svc',
    [string]$AciName = 'podcast-cpu',
    [string]$AksClusterName = 'podcast-aks',
    [string]$AksNamespace = 'podcast',
    [string]$AksDeploymentName = 'podcast-app',
    [string]$AksContainerName = 'podcast',
    [string]$ImageName = 'podcast-cpu'
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path $scriptDir -Parent
$infraDir = Join-Path $repoRoot 'infra'

function Get-AcrCredentials {
    param([string]$Name)
    [pscustomobject]@{
        LoginServer = az acr show --name $Name --query "loginServer" -o tsv
        Username    = az acr credential show --name $Name --query "username" -o tsv
        Password    = az acr credential show --name $Name --query "passwords[0].value" -o tsv
    }
}

$creds = Get-AcrCredentials -Name $AcrName
$image = "$($creds.LoginServer)/$ImageName`:latest"

Write-Host "Image reference: $image" -ForegroundColor Yellow

switch ($Target) {
    'container-app' {
        Write-Host "Updating Container App: $ContainerAppName" -ForegroundColor Cyan
        az containerapp update `
            --name $ContainerAppName `
            --resource-group $ResourceGroup `
            --image $image
    }
    'app-service' {
        Write-Host "Updating App Service: $AppServiceName" -ForegroundColor Cyan
        az webapp config container set `
            --name $AppServiceName `
            --resource-group $ResourceGroup `
            --docker-custom-image-name $image `
            --docker-registry-server-url "https://$($creds.LoginServer)" `
            --docker-registry-server-user $($creds.Username) `
            --docker-registry-server-password $($creds.Password)
        az webapp restart --name $AppServiceName --resource-group $ResourceGroup
    }
    'aci' {
        Write-Host "Updating ACI: $AciName" -ForegroundColor Cyan
        az container restart `
            --name $AciName `
            --resource-group $ResourceGroup
    }
    'aks' {
        Write-Host "Updating AKS deployment image to $image" -ForegroundColor Cyan
        az aks get-credentials --resource-group $ResourceGroup --name $AksClusterName --overwrite-existing
        kubectl set image deployment/$AksDeploymentName $AksContainerName=$image -n $AksNamespace
        kubectl rollout status deployment/$AksDeploymentName -n $AksNamespace
    }
}

Write-Host "Update complete for target: $Target" -ForegroundColor Green
