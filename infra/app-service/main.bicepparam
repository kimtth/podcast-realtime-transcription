using './main.bicep'

param location = 'eastus'
param appName = 'podcast-app'
param planName = 'podcast-app-plan'
param containerImage = ''
param acrLoginServer = ''
param acrUsername = ''
param acrPassword = ''
param appServiceSkuName = 'P1V2'
param containerPort = 3000
