using './main.bicep'

param location = 'eastus'
param clusterName = 'podcast-aks'
param nodeCount = 1
param vmSize = 'Standard_B2s'
param kubernetesVersion = '1.31.1'
param networkPlugin = 'azure'
