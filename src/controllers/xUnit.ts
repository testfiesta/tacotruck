import xUnitParser from '../utils/xUnitParser.js'

interface Config {
  integration: string
  ignoreConfig?: {
    runs?: Record<string, any>
    suites?: Record<string, any>
    executions?: Record<string, any>
  }
  [key: string]: any
}

interface Ids {
  [key: string]: any
}

/**
 * Pulls data from an xUnit file specified in the config
 * @param config Configuration object containing integration file path
 * @param ids Optional IDs object (not currently supported)
 * @returns Parsed xUnit data
 */
export async function pullData(config: Config, ids: Ids = {}): Promise<any> {
  // TODO - Pulling individual data points with `ids` is not currently supported
  // config.progressBar.start(200, 0);
  // Pull data
  const data = new xUnitParser()
    .parseFile(config)

  return data
}

/**
 * Attempts to push data to xUnit format (not supported)
 * @param conf Configuration object
 * @param data Data to push
 */
export function pushData(conf: Config, data: any): void {
  console.error('Invalid target config: Data cannot be pushed into xUnit format')
  process.exit(1)
}
