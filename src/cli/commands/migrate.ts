import * as fs from 'node:fs'
import * as Commander from 'commander'
import { getAvailableConfigs } from '../../utils/configHelpers'
import * as configUtils from '../../utils/configuration'

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
  const availableConfigs = getAvailableConfigs()

  const migrate = new Commander.Command('migrate')
    .option('-c, --credentials <path>', 'Path to credentials file for API connections. If not provided, environment variables will be used. (See README.)')
    .requiredOption('-s, --source <source>', `For type api - One of: ${availableConfigs} or the path to a custom JSON api config.\nFor type junit - the path to a JUnit-style XML file.`)
    .requiredOption('-t, --target <target>', `One of: ${availableConfigs}`)
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
      await run(args).catch((e) => {
        console.error(e)
        process.exit(1)
      })
    })

  return migrate
}

export async function run(args: Args) {
  if (!args.credentials) {
    const sourceEnvKey = `${args.source.toUpperCase()}_SOURCE_CREDENTIALS`
    const targetEnvKey = `${args.target.toUpperCase()}_TARGET_CREDENTIALS`

    console.warn(`No credentials file provided. Looking for environment variables: ${sourceEnvKey} and ${targetEnvKey}`)

    if (!process.env[sourceEnvKey]) {
      console.error(`Missing environment variable: ${sourceEnvKey}`)
      console.error('Either provide this environment variable or use -c flag with a credentials file')
    }

    if (!process.env[targetEnvKey]) {
      console.error(`Missing environment variable: ${targetEnvKey}`)
      console.error('Either provide this environment variable or use -c flag with a credentials file')
    }
  }
  else {
    console.warn(`Using credentials from file: ${args.credentials}`)
    if (!fs.existsSync(args.credentials)) {
      console.error(`Credentials file not found: ${args.credentials}`)
      process.exit(1)
    }
  }

  const config = new configUtils.PipeConfig({
    source: args.source,
    target: args.target,
    credentials: args.credentials,
    incremental: args.incremental,
    ignore: args.ignore,
    overrides: args.overrides,
    dataTypes: args.dataTypes ? args.dataTypes.split(',') : undefined,
    no_git: args.no_git,
  })

  if (args.verbose) {
    console.warn('Using configuration:')
    console.warn(config)
  }
}
