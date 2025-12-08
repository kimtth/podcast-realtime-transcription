param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not $Force) {
    Write-Host "Resources in resource group '$ResourceGroup':" -ForegroundColor Yellow
    & az resource list --resource-group $ResourceGroup --query "[].{Name:name, Type:type}" -o table
    $confirm = Read-Host "Delete all resources in '$ResourceGroup'? (yes/no)"
    if ($confirm -ne 'yes') { return }
}

Write-Host "Deleting resource group '$ResourceGroup'..." -ForegroundColor Cyan
& az group delete --name $ResourceGroup --yes --no-wait
Write-Host "Resource group deletion initiated (running in background)" -ForegroundColor Green
