import * as fs from 'node:fs'
import asyncStorage from './asyncStorage'
import * as auth from './auth'

// Global variables declaration
declare global {
  let packageRoot: string
  let calledViaCLI: boolean
}

const credentialedTypes = ['api']
const validSourceTypes = ['api', 'junit', 'json']
const validTargetTypes = ['api']
const defaultEndpoints = {
  source: 'index',
}

interface Args {
  no_git?: boolean
  overrides?: string | Record<string, any>
  credentials?: string
  dataTypes?: string[]
  incremental?: boolean
  ignore?: string
  source: string
  target: string
  [key: string]: any
}

interface TypeConfig {
  name: string
  type: string
  auth?: {
    type: string
    [key: string]: any
  }
  requests_per_second?: number
  source?: Record<string, any>
  target?: Record<string, any>
  [key: string]: any
}

export interface Credentials {
  base_url: string
  [key: string]: any
}

interface AuthSchema {
  inputs: string[]
  location: string
  key: string
  payload: string
}

export class EndpointConfig {
  direction: string
  integration: string
  overrides?: Record<string, any>
  authSchema?: AuthSchema
  authPayload?: string
  baseUrl?: string
  credentials?: Record<string, any>
  throttleCap: number = 2
  type?: string
  typeConfig?: TypeConfig
  typeLocation?: string
  endpointSet: string[] = []
  gitRepo?: string
  gitBranch?: string
  gitSha?: string
  ignoreConfig?: Record<string, any>
  progressIncrement?: number
  offsets: Record<string, number> = {}

  constructor(args: Args, integration: string, direction: string) {
    this.direction = direction
    this.integration = integration

    // Pull git info if this is run via CLI
    if (globalThis.calledViaCLI && !args.no_git) {
      if (fs.existsSync('.git/config')) {
        const gitConfig = fs.readFileSync('.git/config', { encoding: 'utf-8' })
        const urlLine = gitConfig.split('\n\t').find(config => config.includes('url'))
        this.gitRepo = urlLine ? urlLine.trim().split(' ').pop() || '' : ''

        if (fs.existsSync('.git/HEAD')) {
          const gitHEAD = fs.readFileSync('.git/HEAD', { encoding: 'utf-8' })
          this.gitBranch = gitHEAD.trim().split('refs/heads/').pop() || ''
        }

        if (fs.existsSync('.git/logs/HEAD')) {
          let gitLogSha = fs.readFileSync('.git/logs/HEAD', { encoding: 'utf-8' })
          gitLogSha = gitLogSha.trim().split('\n')
          this.gitSha = gitLogSha.length > 0 ? gitLogSha[gitLogSha.length - 1].split(' ')[0] : ''
        }
      }
      else {
        console.error('Git config not found')
      }
    }

    if (args.overrides) {
      if (typeof args.overrides === 'string') {
        this.overrides = JSON.parse(args.overrides)
      }
      else {
        this.overrides = args.overrides
      }
    }

    // Parse the integration config files.
    try {
      const integrationSplit = this.integration.split(':')
      if (integrationSplit.length > 1) {
        if (integrationSplit.length > 2) {
          console.error(`Invalid local file integration [${this.integration}].`)
          process.exit(1)
        }
        this.integration = integrationSplit[1]
        if (fs.existsSync(this.integration)) {
          // Check if this is a custom type
          this.typeConfig = {
            name: integrationSplit[0],
            type: integrationSplit[0],
          }
        }
      }
      else {
        if (fs.existsSync(this.integration)) {
          this.typeConfig = JSON.parse(fs.readFileSync(`${this.integration}.json`, 'utf-8'))
        }
        else {
          const packageRoot = asyncStorage.getItem('packageRoot')
          if (packageRoot && fs.existsSync(`${packageRoot}/configs/${this.integration}.json`)) {
            // Fall back to defaults
            this.typeConfig = JSON.parse(fs.readFileSync(`${packageRoot}/configs/${this.integration}.json`, 'utf-8'))
          }
          else if (this.integration) {
            console.error(`Integration config not found: ${this.integration}`)
            process.exit(1)
          }
        }
      }
    }
    catch (err) {
      console.error(`Invalid integration config: ${err}`)
      process.exit(1)
    }

    // Ensure the "type" for the integration is valid.
    if (!this.typeConfig?.type) {
      console.error(`Missing 'type' for [${this.integration}]`)
      process.exit(1)
    }
    else {
      if (this.direction === 'source'
        && !validSourceTypes.includes(this.typeConfig.type)) {
        console.error(`Invalid source type: ${this.typeConfig.type}`)
        process.exit(1)
      }
      if (this.direction === 'target'
        && !validTargetTypes.includes(this.typeConfig.type)) {
        console.error(`Invalid target type: ${this.typeConfig.type}`)
        process.exit(1)
      }
    }

    if (!this.typeConfig.name) {
      console.error('Configuration file must specify a "name" to identify the service.')
      process.exit(1)
    }

    // Parse credentials file and ensure it matches expected data based on
    // type provided in the config
    if (credentialedTypes.includes(this.typeConfig.type)) {
      try {
        if (args.credentials) {
          const creds = args.credentials
          this.credentials = creds[this.integration][this.direction]
          this.baseUrl = creds[this.integration][this.direction].base_url
        }
        else {
          const envKey = `${this.integration.toUpperCase()}_${this.direction.toUpperCase()}_CREDENTIALS`
          const envValue = process.env[envKey]

          if (!envValue) {
            throw new Error(`Environment variable ${envKey} not found`)
          }

          const creds = JSON.parse(envValue)
          this.credentials = creds[this.direction]
          this.baseUrl = creds[this.direction].base_url
        }

        if (!this.credentials && !this.baseUrl) {
          console.error(
            `Credentials missing for [${this.integration} - ${this.direction}]`,
          )
          process.exit(1)
        }
      }
      catch (err) {
        console.error(`Issue reading ${this.integration} credentials: ${err}`)
        process.exit(1)
      }

      try {
        if (!this.typeConfig.auth?.type || !auth.authSchemas[this.typeConfig.auth.type]) {
          throw new Error(`Invalid auth type: ${this.typeConfig.auth?.type}`)
        }

        this.authSchema = auth.authSchemas[this.typeConfig.auth.type]
      }
      catch (err) {
        console.error(`Invalid auth configuration: ${err}`)
        process.exit(1)
      }

      // Build our credentials
      if (this.authSchema && this.credentials) {
        for (const key of this.authSchema.inputs) {
          if (!this.credentials[key]) {
            console.error(
              `Invalid credentials for ${this.integration} - ${this.direction}.`
              + `\n Missing input: ${key}`,
            )
            process.exit(1)
          }
          else {
            const keyIndex = this.authSchema.payload.indexOf(key)
            if (keyIndex < 0) {
              console.error(`Key [${key}] not found in payload.`)
              process.exit(1)
            }
            // Do our substitutions to build the payload.
            this.authPayload
              = this.authSchema.payload.substring(0, keyIndex - 1)
                + this.credentials[key]
                + this.authSchema.payload.substring(
                  keyIndex + key.length + 1,
                  this.authSchema.payload.length,
                )
          }
        }
      }
    }

    // Handle integration type specifics
    if (this.typeConfig.type === 'api') {
      if (this.typeConfig.requests_per_second) {
        if (Number.isNaN(Number(this.typeConfig.requests_per_second))) {
          console.error(
            `Invalid config "requests_per_second" on [${this.integration}] API.`,
          )
        }
        else {
          this.throttleCap = Number(this.typeConfig.requests_per_second)
        }
      }

      // Parse integration config and build dependency graph to determine
      //   access order
      let endpointOrder: string[] = []
      let endpoints: string[] = []
      if (args.dataTypes && args.dataTypes.length > 0) {
        for (const type of args.dataTypes) {
          if (!this.typeConfig?.[this.direction]?.[type]) {
            console.error(
              `Invalid data type [${type}] for [${this.integration}]. Ignoring.`,
            )
          }
          else {
            endpoints.push(type)
          }
        }
      }
      else {
        endpoints = Object.keys(this.typeConfig[this.direction] || {})
      }

      if (defaultEndpoints[this.direction as keyof typeof defaultEndpoints]) {
        for (const name of endpoints) {
          endpointOrder.push(...buildDependencyChain(
            this.typeConfig[this.direction],
            name,
            defaultEndpoints[this.direction as keyof typeof defaultEndpoints],
          ))
        }
      }
      else {
        endpointOrder = endpoints
      }

      if (endpointOrder.length < 1) {
        console.error(
          `No valid data types provided for [${this.integration}].`,
        )
        process.exit(1)
      }

      endpointOrder.forEach((endpoint) => {
        if (!this.endpointSet.includes(endpoint)) {
          this.endpointSet.push(endpoint)
        }
      })
      this.progressIncrement = 100 / this.endpointSet.length

      // If incremental, get last offsets from target config
      for (const endpoint of this.endpointSet) {
        if (args.incremental) {
          // TODO
        }
        else {
          this.offsets[endpoint] = 0
          // TODO use this
        }
      }
    }
    else if (this.typeConfig.type === 'junit') {
      // NOOP
    }

    // Parse the ignore file
    try {
      if (args.ignore) {
        if (fs.existsSync(args.ignore)) {
          // Check if this is a custom type
          this.ignoreConfig = JSON.parse(fs.readFileSync(args.ignore, 'utf-8'))
        }
      }
    }
    catch (err) {
      console.error(`Invalid ignore config: ${err}`)
    }
  }
}

export class PipeConfig {
  sourceConfigs: EndpointConfig[] = []
  targetConfigs: EndpointConfig[] = []

  constructor(args: Args) {
    const sources = args.source.split(',')
    for (const source of sources) {
      this.sourceConfigs.push(new EndpointConfig(args, source, 'source'))
    }
    if (this.sourceConfigs.length < 1) {
      console.error('You must specify at least one data source.')
      process.exit(1)
    }

    const targets = args.target.split(',')
    for (const target of targets) {
      this.targetConfigs.push(new EndpointConfig(args, target, 'target'))
    }
    if (this.targetConfigs.length < 1) {
      console.error('You must specify at least one data target.')
      process.exit(1)
    }
  }
}

export interface KeyMap {
  [key: string]: {
    endpoints?: {
      [key: string]: {
        path?: string
        bulk_path?: string
        single_path?: string
        [key: string]: any
      }
    }
    [key: string]: any
  }
}

// Find all dependencies in chain
export function buildDependencyChain(keyMap: KeyMap, name: string, endpointSelector: string): string[] {
  let path = keyMap[name]?.endpoints?.[endpointSelector]?.path
  path ||= keyMap[name]?.endpoints?.[endpointSelector]?.bulk_path
  path ||= keyMap[name]?.endpoints?.[endpointSelector]?.single_path
  if (!keyMap[name] || !path) {
    console.error(`Invalid key [${name}].`)
    process.exit(1)
  }
  if (!path.includes('{')) {
    return [name]
  }
  else {
    const keys = findSubstitutionKeys(path)
    const dependencyMap: string[] = []
    for (const dependency of keys) {
      dependencyMap.push(
        ...buildDependencyChain(keyMap, dependency.split('.')[0], endpointSelector),
      )
    }
    dependencyMap.push(name)
    return dependencyMap
  }
}

export function findSubstitutionKeys(keyString: string): string[] {
  const keys: string[] = []
  // Find keys on the path in brackets
  let fragment = keyString
  let startIndex = fragment.indexOf('{')
  while (startIndex > -1) {
    const endIndex = fragment.indexOf('}')
    if (endIndex < 0) {
      console.error(`Unmatched brackets in API path`)
      process.exit(1)
    }
    keys.push(fragment.substring(startIndex + 1, endIndex))
    fragment = fragment.substring(endIndex + 1, fragment.length)
    startIndex = fragment.indexOf('{')
  }
  return keys
}

export function bracketSubstitution(baseString: string, oldKey: string, newKey: string): string {
  return baseString.substring(0, baseString.indexOf(`{${oldKey}`))
    + newKey
    + baseString.substring(
      baseString.indexOf(`{${oldKey}`) + oldKey.length + 2,
      baseString.length,
    )
}
