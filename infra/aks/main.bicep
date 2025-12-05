param location string = resourceGroup().location
param clusterName string = 'podcast-aks'
param nodeCount int = 1
param vmSize string = 'Standard_D2s_v3'
param gpuNodeCount int = 1
param gpuVmSize string = 'Standard_NC6s_v3'
param kubernetesVersion string = '1.27'
param networkPlugin string = 'azure'

// Create User-Assigned Managed Identity
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${clusterName}-mi'
  location: location
}

// Create AKS Cluster
resource aksCluster 'Microsoft.ContainerService/managedClusters@2023-06-01' = {
  name: clusterName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    kubernetesVersion: kubernetesVersion
    dnsPrefix: clusterName
    enableRBAC: true
    networkProfile: {
      networkPlugin: networkPlugin
      serviceCidr: '10.0.0.0/16'
      dnsServiceIP: '10.0.0.10'
    }
    agentPoolProfiles: [
      {
        name: 'systempool'
        count: nodeCount
        vmSize: vmSize
        mode: 'System'
        type: 'VirtualMachineScaleSets'
      }
    ]
    addonProfiles: {
      httpApplicationRouting: {
        enabled: false
      }
      omsagent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalytics.id
        }
      }
    }
  }
}

// Add GPU Node Pool
resource gpuNodePool 'Microsoft.ContainerService/managedClusters/agentPools@2023-06-01' = {
  parent: aksCluster
  name: 'gpupool'
  properties: {
    count: gpuNodeCount
    vmSize: gpuVmSize
    mode: 'User'
    type: 'VirtualMachineScaleSets'
    nodeLabels: {
      workload: 'gpu'
      accelerator: 'nvidia-tesla-k80'
    }
    nodeTaints: [
      'nvidia.com/gpu=true:NoSchedule'
    ]
  }
}

// Create Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2021-12-01-preview' = {
  name: '${clusterName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

output clusterId string = aksCluster.id
output clusterName string = aksCluster.name
output logAnalyticsId string = logAnalytics.id
