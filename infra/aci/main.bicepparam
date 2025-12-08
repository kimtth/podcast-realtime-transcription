using './main.bicep'

param location = 'eastus'
param containerGroupName = 'podcast-cpu'
param containerImage = ''
param acrLoginServer = ''
param acrUsername = ''
param acrPassword = ''
param cpuCores = 4
param memoryInGb = 8
