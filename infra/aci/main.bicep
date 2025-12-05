param location string = resourceGroup().location
param containerGroupName string = 'podcast-cpu'
param containerImage string
param acrLoginServer string
param acrUsername string
@secure()
param acrPassword string
param osType string = 'Linux'
param restartPolicy string = 'OnFailure'
param cpuCores int = 4
param memoryInGb int = 8

// Note: ACI GPU support was retired July 14, 2025
// This deployment uses CPU-only configuration

// Create Container Instance
resource containerInstance 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: containerGroupName
  location: location
  properties: {
    containers: [
      {
        name: containerGroupName
        properties: {
          image: containerImage
          resources: {
            requests: {
              cpu: cpuCores
              memoryInGB: memoryInGb
            }
          }
          ports: [
            {
              port: 3000
              protocol: 'TCP'
            }
            {
              port: 8000
              protocol: 'TCP'
            }
          ]
          environmentVariables: []
        }
      }
    ]
    osType: osType
    restartPolicy: restartPolicy
    imageRegistryCredentials: [
      {
        server: acrLoginServer
        username: acrUsername
        password: acrPassword
      }
    ]
    ipAddress: {
      type: 'Public'
      ports: [
        {
          port: 3000
          protocol: 'TCP'
        }
        {
          port: 8000
          protocol: 'TCP'
        }
      ]
      dnsNameLabel: containerGroupName
    }
  }
}

output containerGroupFqdn string = containerInstance.properties.ipAddress.fqdn
output containerGroupIp string = containerInstance.properties.ipAddress.ip
output containerId string = containerInstance.id
