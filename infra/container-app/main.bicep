param location string = resourceGroup().location
param appName string = 'podcast-app'
param environmentName string = 'podcast-env'
param containerImage string
param acrLoginServer string
param acrUsername string
@secure()
param acrPassword string
param containerPort int = 3000
param cpuCores string = '2'
param memory string = '4Gi'
param minReplicas int = 1
param maxReplicas int = 3

// Create Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2021-12-01-preview' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

// Create Container App Environment
resource environment 'Microsoft.App/managedEnvironments@2023-04-01-preview' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Create Container App
resource containerApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acrPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          resources: {
            cpu: json(cpuCores)
            memory: memory
          }
          env: []
          probes: [
            {
              type: 'liveness'
              httpGet: {
                path: '/'
                port: containerPort
              }
              initialDelaySeconds: 30
              periodSeconds: 10
            }
            {
              type: 'readiness'
              httpGet: {
                path: '/'
                port: containerPort
              }
              initialDelaySeconds: 5
              periodSeconds: 5
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppUrl string = containerApp.properties.configuration.ingress.fqdn
output containerAppId string = containerApp.id
output environmentId string = environment.id
