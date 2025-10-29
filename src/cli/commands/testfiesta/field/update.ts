import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface UpdateCustomFieldArgs extends BaseArgs {
  project: string
  customFieldId: string
  name?: string
  description?: string
  required?: boolean
  defaultValue?: string
  options?: string
  token: string
  organization: string
  verbose?: boolean
}

export function fieldUpdateCommand() {
  return new Commander.Command('field:update')
    .description(cliDescriptions.FIELD_UPDATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --custom-field-id <customFieldId>', cliOptions.FIELD_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-n, --name <name>', cliOptions.FIELD_NAME)
    .option('-d, --description <description>', cliOptions.FIELD_DESCRIPTION)
    .option('-r, --required', cliOptions.FIELD_REQUIRED)
    .option('--default-value <defaultValue>', cliOptions.FIELD_DEFAULT_VALUE)
    .option('--options <options>', cliOptions.FIELD_OPTIONS)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: UpdateCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runUpdateCustomField(args).catch((e) => {
        p.log.error('Failed to update custom field')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runUpdateCustomField(args: UpdateCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.UPDATING_FIELD)

    const updateData: any = {}

    if (args.name)
      updateData.name = args.name
    if (args.description !== undefined)
      updateData.description = args.description
    if (args.required !== undefined)
      updateData.required = args.required
    if (args.defaultValue !== undefined)
      updateData.defaultValue = args.defaultValue
    if (args.options) {
      try {
        updateData.options = JSON.parse(args.options)
      }
      catch {
        spinner.stop('Invalid options format')
        p.log.error(cliMessages.INVALID_OPTIONS_FORMAT)
        return
      }
    }

    if (Object.keys(updateData).length === 0) {
      spinner.stop('No updates provided')
      p.log.warn(cliMessages.NO_UPDATES_PROVIDED)
      return
    }

    const result = await tfClient.updateCustomField(args.project, args.customFieldId, updateData)
    spinner.stop(cliMessages.FIELD_UPDATED)

    p.log.success(`Custom field "${result.name}" (${result.uid}) updated successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.FIELD_UPDATE_FAILED)
    throw error
  }
}
