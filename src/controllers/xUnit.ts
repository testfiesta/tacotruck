import XUnitParser from '../utils/xunit-parser'

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
 * @param _ids Optional IDs object (not currently supported)
 * @returns Parsed xUnit data
 */
export async function pullData(config: Config, _ids: Ids = {}): Promise<any> {
  // TODO - Pulling individual data points with `ids` is not currently supported
  // config.progressBar.start(200, 0);
  // Pull data
  const data = new XUnitParser()
    .parseFile(config)

  return data
}

/**
 * Attempts to push data to xUnit format (not supported)
 * @param _conf Configuration object
 * @param _data Data to push
 */
export function pushData(_conf: Config, _data: any): void {
  console.error('Invalid target config: Data cannot be pushed into xUnit format')
  process.exit(1)
}
