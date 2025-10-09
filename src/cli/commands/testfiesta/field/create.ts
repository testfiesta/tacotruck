import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface CreateCustomFieldArgs extends BaseArgs {
  project: string
  name: string
  type: string
  description?: string
  required?: boolean
  defaultValue?: string
  options?: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function fieldCreateCommand() {
  return new Commander.Command('field:create')
    .description(cliDescriptions.FIELD_CREATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-n, --name <name>', cliOptions.FIELD_NAME)
    .requiredOption('--type <type>', cliOptions.FIELD_TYPE)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-d, --description <description>', cliOptions.FIELD_DESCRIPTION)
    .option('-r, --required', cliOptions.FIELD_REQUIRED)
    .option('--default-value <defaultValue>', cliOptions.FIELD_DEFAULT_VALUE)
    .option('--options <options>', cliOptions.FIELD_OPTIONS)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: CreateCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateCustomField(args).catch((e) => {
        p.log.error('Failed to create custom field')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runCreateCustomField(args: CreateCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.CREATING_FIELD)

    const customFieldData: any = {
      name: args.name,
      type: args.type,
      required: !!args.required,
    }

    if (args.description) {
      customFieldData.description = args.description
    }
    if (args.defaultValue) {
      customFieldData.defaultValue = args.defaultValue
    }
    if (args.options) {
      try {
        customFieldData.options = JSON.parse(args.options)
      }
      catch {
        spinner.stop('Invalid options format')
        p.log.error(cliMessages.INVALID_OPTIONS_FORMAT)
        return
      }
    }

    const result = await tfClient.createCustomField(args.project, customFieldData)
    spinner.stop(cliMessages.FIELD_CREATED)

    p.log.success(`Custom field "${result.name}" created with ID: ${result.uid}`)
  }
  catch (error) {
    spinner.stop(cliMessages.FIELD_CREATE_FAILED)
    throw error
  }
}
