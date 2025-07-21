import type { ConfigType, CredentialsConfig } from './config-schema'
import type { Result } from './result'
import * as fs from 'node:fs'
import asyncStorage from './async-storage'
import { validateConfig, validateCredentials } from './config-schema'
import { err, ok } from './result'

export interface ConfigLoaderOptions {
  configPath?: string
  configName?: string
  credentials?: Record<string, any>
  overrides?: Record<string, any>
  dataTypes?: string[]
  incremental?: boolean
  noGit?: boolean
}

/**
 * Load configuration from file or environment variables
 * @param options Configuration loader options
 * @returns Result with validated configuration or error
 */
export function loadConfig(options: ConfigLoaderOptions = {}): Result<ConfigType, Error> {
  try {
    let configPath = options.configPath
    const configName = options.configName

    if (!configPath && !configName) {
      const packageRoot = asyncStorage.getItem('packageRoot') || process.env.PACKAGE_ROOT || ''
      if (packageRoot && fs.existsSync(`${packageRoot}/configs/default.json`)) {
        configPath = `${packageRoot}/configs/default.json`
      }
      else if (fs.existsSync('./configs/default.json')) {
        configPath = './configs/default.json'
      }
      else {
        return err(new Error('No config parameters provided and no default config found'))
      }
    }

    if (!configPath && configName) {
      const packageRoot = asyncStorage.getItem('packageRoot') || process.env.PACKAGE_ROOT || ''

      if (packageRoot && fs.existsSync(`${packageRoot}/configs/${configName}.json`)) {
        configPath = `${packageRoot}/configs/${configName}.json`
      }
      else if (fs.existsSync(`./configs/${configName}.json`)) {
        configPath = `./configs/${configName}.json`
      }
      else if (fs.existsSync(`./${configName}.json`)) {
        configPath = `./${configName}.json`
      }
      else {
        return err(new Error(`Configuration file not found for ${configName}`))
      }
    }

    if (!fs.existsSync(configPath!)) {
      return err(new Error(`Config file not found: ${configPath}`))
    }

    const configContent = fs.readFileSync(configPath!, 'utf-8')
    let config: unknown

    try {
      config = JSON.parse(configContent)
    }
    catch (parseError) {
      return err(new Error(`Failed to parse config file: ${parseError instanceof Error ? parseError.message : String(parseError)}`))
    }

    if (options.overrides && typeof config === 'object' && config !== null) {
      config = { ...config, ...options.overrides }
    }
    const validatedConfigResult = validateConfig(config)
    if (!validatedConfigResult.isOk) {
      return validatedConfigResult
    }

    const validatedConfig = validatedConfigResult.unwrap()

    if (!options.noGit) {
      const gitInfo = extractGitInfo()
      if (gitInfo && typeof validatedConfig === 'object') {
        (validatedConfig as any).gitInfo = gitInfo
      }
    }

    return ok(validatedConfig)
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error('Unknown error loading configuration'))
  }
}

/**
 * Load credentials from environment variables or provided object
 * @param integrationName Name of the integration
 * @param direction 'source' or 'target'
 * @param credentials Optional credentials object
 * @returns Result with validated credentials or error
 */
export function loadCredentials(
  integrationName: string,
  direction: 'source' | 'target',
  credentials?: Record<string, any>,
): Result<CredentialsConfig, Error> {
  try {
    let credentialsData: unknown

    if (credentials) {
      credentialsData = credentials[integrationName]?.[direction]
    }
    else {
      const envKey = `${integrationName.toUpperCase()}_${direction.toUpperCase()}_CREDENTIALS`
      const envValue = process.env[envKey]

      if (!envValue) {
        return err(new Error(`Environment variable ${envKey} not found`))
      }

      try {
        const parsedEnv = JSON.parse(envValue)
        credentialsData = parsedEnv[direction]
      }
      catch (parseError) {
        return err(new Error(`Failed to parse credentials from environment: ${parseError instanceof Error ? parseError.message : String(parseError)}`))
      }
    }

    if (!credentialsData) {
      return err(new Error(`Credentials not found for ${integrationName} - ${direction}`))
    }

    return validateCredentials(credentialsData)
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error('Unknown error loading credentials'))
  }
}

/**
 * Extract git information from the repository
 * @returns Git information or null if not available
 */
function extractGitInfo(): { repo?: string, branch?: string, sha?: string } | null {
  try {
    const gitInfo: { repo?: string, branch?: string, sha?: string } = {}

    if (fs.existsSync('.git/config')) {
      const gitConfig = fs.readFileSync('.git/config', { encoding: 'utf-8' })
      const urlLine = gitConfig.split('\n\t').find(config => config.includes('url'))
      gitInfo.repo = urlLine ? urlLine.trim().split(' ').pop() || '' : ''

      if (fs.existsSync('.git/HEAD')) {
        const gitHEAD = fs.readFileSync('.git/HEAD', { encoding: 'utf-8' })
        gitInfo.branch = gitHEAD.trim().split('refs/heads/').pop() || ''
      }

      if (fs.existsSync('.git/logs/HEAD')) {
        const gitLogContent = fs.readFileSync('.git/logs/HEAD', { encoding: 'utf-8' })
        const gitLogLines = gitLogContent.trim().split('\n')
        gitInfo.sha = gitLogLines.length > 0 ? gitLogLines[gitLogLines.length - 1].split(' ')[0] : ''
      }

      return gitInfo
    }
  }
  catch (error) {
    console.error('Error extracting git info:', error)
  }

  return null
}

/**
 * Find substitution keys in a path string
 * @param pathString Path string with potential substitution keys
 * @returns Array of substitution keys
 */
export function findSubstitutionKeys(pathString: string): string[] {
  const keys: string[] = []
  let fragment = pathString
  let startIndex = fragment.indexOf('{')

  while (startIndex > -1) {
    const endIndex = fragment.indexOf('}')
    if (endIndex > startIndex) {
      const key = fragment.substring(startIndex + 1, endIndex)
      keys.push(key)
      fragment = fragment.substring(endIndex + 1)
      startIndex = fragment.indexOf('{')
    }
    else {
      break
    }
  }

  return keys
}

/**
 * Replace a placeholder in a string with a value
 * @param baseString The string containing the placeholder
 * @param oldKey The key to replace (without braces)
 * @param newKey The value to insert
 * @returns The string with the placeholder replaced
 */
export function bracketSubstitution(baseString: string, oldKey: string, newKey: string): string {
  return baseString.substring(0, baseString.indexOf(`{${oldKey}`))
    + newKey
    + baseString.substring(
      baseString.indexOf(`{${oldKey}`) + oldKey.length + 2,
      baseString.length,
    )
}

/**
 * Build dependency chain for endpoints
 * @param config Configuration object
 * @param entityType Entity type name
 * @param operation Operation name
 * @returns Result with array of dependency names in order or error
 */
export function buildDependencyChain(
  config: ConfigType,
  entityType: string,
  operation: string,
): Result<string[], Error> {
  if (config.type !== 'api') {
    return ok([entityType])
  }

  const entityConfig = config.source?.[entityType] || config.target?.[entityType]
  if (!entityConfig) {
    return err(new Error(`Invalid entity type: ${entityType}`))
  }

  const endpoint = entityConfig.endpoints[operation]
  if (!endpoint) {
    return err(new Error(`Invalid operation: ${operation} for entity ${entityType}`))
  }

  const path = endpoint.path || endpoint.bulk_path || endpoint.single_path
  if (!path) {
    return err(new Error(`No path defined for ${entityType}.${operation}`))
  }

  if (!path.includes('{')) {
    return ok([entityType])
  }
  else {
    try {
      const keys = findSubstitutionKeys(path)
      const dependencyMap: string[] = []

      for (const dependency of keys) {
        const dependencyType = dependency.split('.')[0]
        const subDependenciesResult = buildDependencyChain(config, dependencyType, operation)

        if (!subDependenciesResult.isOk) {
          return subDependenciesResult
        }

        dependencyMap.push(...subDependenciesResult.unwrap())
      }

      dependencyMap.push(entityType)
      return ok([...new Set(dependencyMap)])
    }
    catch (error) {
      return err(error instanceof Error ? error : new Error('Unknown error building dependency chain'))
    }
  }
}
