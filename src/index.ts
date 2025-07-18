import * as apiController from './controllers/api.js'
import * as jsonController from './controllers/json.js'
import * as xUnitController from './controllers/xunit.js'
import * as configUtils from './utils/configuration'

export async function pullData(args, ids = {}) {
  const config = new configUtils.PipeConfig(args)
  const responseData = []
  for (const sourceConfig of config.sourceConfigs) {
    switch (sourceConfig.typeConfig.type) { // CTODO - just pass sourceTypeConfig
      case 'api':
        responseData.push(await apiController.pullData(sourceConfig, ids))
        break
      case 'junit':
        responseData.push(await xUnitController.pullData(sourceConfig, ids))
        break
      case 'json':
        responseData.push(await jsonController.pullData(sourceConfig, ids))
        break
      default:
        console.log(`Unable to process source type: ${sourceConfig.type}`)
        process.exit()
    }
  }
  return responseData
}

export function pushData(args, data) {
  const config = new configUtils.PipeConfig(args)
  if (!Array.isArray(data)) {
    data = [data]
  }
  for (const sourceData of data) {
    for (const targetConfig of config.targetConfigs) {
      switch (targetConfig.typeConfig.type) {
        case 'api':
          apiController.pushData(targetConfig, sourceData)
          break
        case 'junit':
          xUnitController.pushData(targetConfig, sourceData)
          break
        default:
          console.log(`Unable to process target type: ${targetConfig.type}`)
          process.exit()
      }
    }
  }
}
