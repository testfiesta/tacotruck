import * as fs from 'node:fs'
import * as Commander from 'commander'
import { dataType } from '../../utils/config-schema'
import * as enhancedLoader from '../../utils/enhanced-config-loader'
import { getLogger, initializeLogger, setVerbose } from '../../utils/logger'

interface Args {
  source: string
  target: string
  credentials?: string
  incremental?: boolean
  ignore?: string
  overrides?: string | Record<string, any>
  dataTypes?: string
  no_git?: boolean
  verbose?: boolean
}

export function createMigrateCommand() {
  const migrate = new Commander.Command('migrate')
    .option('-c, --credentials <path>', 'Path to credentials file for API connections. If not provided, environment variables will be used. (See README.)')
    .requiredOption('-s, --source <source>', `For type api - One of: ${dataType.join(', ')} or the path to a custom JSON api config.\nFor type junit - the path to a JUnit-style XML file.`)
    .requiredOption('-t, --target <target>', `One of: ${dataType.join(', ')}`)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .description('Migrate data from source to target')
    .addHelpText('after', `
    Examples:
    # Using environment variables for credentials (default)
    $ tacotruck migrate -s testrails -t testfiesta

    # Using a credentials file
    $ tacotruck migrate -s testrails -t testfiesta -c ./credentials.json

    Environment variables format:
    <SOURCE>_SOURCE_CREDENTIALS and <TARGET>_TARGET_CREDENTIALS
    Example: \n TESTFIESTA_SOURCE_CREDENTIALS='{"source":{"base_url":"https://api.example.com"}}' \n TESTRAILS_TARGET_CREDENTIALS='{"target":{"base_url":"https://api.example.com"}}'
    `)
    .action(async (args: Args) => {
      initializeLogger({ verbose: args.verbose })
      setVerbose(!!args.verbose)
      await run(args).catch((e) => {
        const logger = getLogger()
        logger.error(`Failed to migrate data: ${e instanceof Error ? e.message : String(e)}`)
        process.exit(1)
      })
    })

  return migrate
}

export async function run(args: Args) {
  const logger = getLogger()
  let parsedCredentials: Record<string, any> | undefined
  if (typeof args.credentials === 'string') {
    logger.info(`Using credentials from file: ${args.credentials}`)
    if (!fs.existsSync(args.credentials)) {
      logger.error(`Credentials file not found: ${args.credentials}`)
      process.exit(1)
    }

    try {
      // eslint-disable-next-line unused-imports/no-unused-vars
      parsedCredentials = JSON.parse(fs.readFileSync(args.credentials, 'utf-8'))
    }
    catch (error) {
      logger.error(`Failed to parse credentials file: ${args.credentials}`, { error })
      process.exit(1)
    }
  }
  else {
    const sourceEnvKey = `${args.source.toUpperCase()}_SOURCE_CREDENTIALS`
    const targetEnvKey = `${args.target.toUpperCase()}_TARGET_CREDENTIALS`

    logger.info(`No credentials file provided. Looking for environment variables: ${sourceEnvKey} and ${targetEnvKey}`)

    if (!process.env[sourceEnvKey]) {
      logger.error(`Missing environment variable: ${sourceEnvKey}`)
      logger.error('Either provide this environment variable or use -c flag with a credentials file')
    }

    if (!process.env[targetEnvKey]) {
      logger.error(`Missing environment variable: ${targetEnvKey}`)
      logger.error('Either provide this environment variable or use -c flag with a credentials file')
    }
  }

  let parsedOverrides: Record<string, any> | undefined
  if (typeof args.overrides === 'string') {
    try {
      parsedOverrides = JSON.parse(args.overrides)
    }
    catch (error) {
      logger.error(`Failed to parse overrides: ${args.overrides}`, { error })
      process.exit(1)
    }
  }
  else {
    parsedOverrides = args.overrides
  }

  const sourceConfigs = args.source.split(',').map((source) => {
    const result = enhancedLoader.loadConfig({
      configName: source,
      overrides: parsedOverrides,
      dataTypes: args.dataTypes ? args.dataTypes.split(',') : undefined,
      incremental: args.incremental,
      noGit: args.no_git,
    })

    if (!result.isOk) {
      logger.error(`Failed to load source config: ${source}`)
      process.exit(1)
    }

    return result.unwrap()
  })

  const targetConfigs = args.target.split(',').map((target) => {
    const result = enhancedLoader.loadConfig({
      configName: target,
      overrides: parsedOverrides,
      dataTypes: args.dataTypes ? args.dataTypes.split(',') : undefined,
      incremental: args.incremental,
      noGit: args.no_git,
    })

    if (!result.isOk) {
      logger.error(`Failed to load target config: ${target}`)
      process.exit(1)
    }

    return result.unwrap()
  })

  const config = { sourceConfigs, targetConfigs }

  if (args.verbose) {
    logger.debug('Using configuration:', { config })
  }
}
