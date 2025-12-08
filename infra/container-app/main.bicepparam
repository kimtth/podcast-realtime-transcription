using './main.bicep'

param location = 'eastus'
param appName = 'podcast-app'
param environmentName = 'podcast-env'
param containerImage = ''
param acrLoginServer = ''
param acrUsername = ''
param acrPassword = ''
param cpuCores = '2'
param memory = '4Gi'
param minReplicas = 1
param maxReplicas = 3
param containerPort = 3000
