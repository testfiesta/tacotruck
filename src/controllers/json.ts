import type { Buffer } from 'node:buffer'
import * as fs from 'node:fs'

export interface Config {
  integration: string
  [key: string]: any
}

export interface Ids {
  [key: string]: any
}

/**
 * Pulls data from a JSON file specified in the config
 * @param config Configuration object containing integration file path
 * @param _ids Optional IDs object
 * @returns Parsed JSON data
 */
export async function pullData(config: Config, _ids: Ids = {}): Promise<any> {
  try {
    const fileContent: Buffer = fs.readFileSync(config.integration)
    let data: any

    try {
      data = JSON.parse(fileContent.toString())
    }
    catch (error: any) {
      throw new Error(`Error parsing JSON: ${error.message}`)
    }

    if (typeof data !== 'object' || data === null) {
      throw new Error(`Invalid file content in ${config.integration}`)
    }

    if (!data) {
      throw new Error(`No data found in file: ${config.integration}`)
    }

    return data
  }
  catch (error: any) {
    console.error(error.message)
    process.exit(1)
  }
}
