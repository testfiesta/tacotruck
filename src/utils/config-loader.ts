import type { ConfigType } from './config-schema'
import type { Err } from './result'

import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig as enhancedLoadConfig } from './enhanced-config-loader'

/**
 * Load and parse a configuration file
 * @param configPath Path to the configuration file
 * @returns Configuration object
 */
export async function loadConfig(configPath: string, credentials?: Record<string, any>): Promise<ConfigType> {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`)
  }

  const configName = path.basename(configPath, '.json')

  const result = enhancedLoadConfig({
    configPath,
    configName,
    credentials,
    noGit: true,
  })

  if (!result.isOk) {
    throw (result as Err<ConfigType, Error>).error
  }

  return result.unwrap()
}
