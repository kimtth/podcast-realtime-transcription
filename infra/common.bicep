// Shared Azure Resources Module
// Used by all deployment options: Container Apps, ACI, App Service, AKS
// 
// Defines:
// - Azure Container Registry (ACR) - required for container deployments
// - Azure Speech Service - required for transcription service
// - Log Analytics Workspace (optional) - for monitoring

@description('Location for all resources')
param location string = resourceGroup().location

@description('Azure Container Registry name (must be globally unique, alphanumeric only)')
param acrName string

@description('Azure Container Registry SKU')
param acrSku string = 'Standard'

@description('Azure Speech Service name')
param speechServiceName string

@description('Azure Speech Service SKU')
param speechServiceSku string = 'S0'

@description('Create Log Analytics Workspace')
param createLogAnalytics bool = false

@description('Log Analytics Workspace name')
param logAnalyticsName string = 'podcast-logs-${uniqueString(resourceGroup().id)}'

@description('Tags for all resources')
param tags object = {
  project: 'podcast-app'
}

// Azure Container Registry (required)
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: acrSku
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

// Azure Speech Service (required)
resource speechService 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: speechServiceName
  location: location
  tags: tags
  kind: 'SpeechServices'
  sku: {
    name: speechServiceSku
  }
  properties: {}
}

// Log Analytics Workspace (optional - for monitoring)
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (createLogAnalytics) {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Outputs
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output speechServiceEndpoint string = speechService.properties.endpoint
output speechServiceName string = speechService.name
output logAnalyticsId string = createLogAnalytics ? logAnalyticsWorkspace.id : ''
