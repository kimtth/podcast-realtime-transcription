param location string = resourceGroup().location
param appName string = 'podcast-app'
param planName string = '${appName}-plan'
param containerImage string
param acrLoginServer string
param acrUsername string
@secure()
param acrPassword string
param appServiceSkuName string = 'P1V2'
param containerPort int = 3000

// Create App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: planName
  location: location
  kind: 'linux'
  properties: {
    reserved: true
  }
  sku: {
    name: appServiceSkuName
    tier: appServiceSkuName == 'P1V2' ? 'PremiumV2' : 'Premium'
    capacity: 1
  }
}

// Create Web App
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: acrUsername
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: acrPassword
        }
        {
          name: 'WEBSITES_PORT'
          value: string(containerPort)
        }
      ]
      healthCheckPath: '/'
      numberOfWorkers: 1
      defaultDocuments: []
    }
  }
}

output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppId string = webApp.id
output appServicePlanId string = appServicePlan.id
