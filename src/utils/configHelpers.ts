import fs from 'node:fs'
import asyncStorage from './asyncStorage'

/**
 * Gets the list of available configuration files
 * @returns A comma-separated string of available config names
 */
export function getAvailableConfigs(): string {
  const packageRoot = asyncStorage.getItem('packageRoot')

  if (!packageRoot) {
    throw new Error('Package root not found in AsyncStorage')
  }

  return fs.readdirSync(`${packageRoot}/configs`)
    .filter(file => !(/(^|\/)\.[^/.]/).test(file))
    .map(file => file.split('.')[0])
    .join(', ')
}
