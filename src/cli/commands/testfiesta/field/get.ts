import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createDetailsTable } from '../../../../utils/table'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetCustomFieldArgs extends BaseArgs {
  project: string
  customFieldId: string
  token: string
  organization: string
  verbose?: boolean
}

export function fieldGetCommand() {
  return new Commander.Command('field:get')
    .description(cliDescriptions.FIELD_GET)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --custom-field-id <customFieldId>', cliOptions.FIELD_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runGetCustomField(args).catch((e) => {
        p.log.error('Failed to get custom field')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runGetCustomField(args: GetCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_FIELD)
    const result = await tfClient.getCustomField(args.project, args.customFieldId)
    spinner.stop(cliMessages.FIELD_RETRIEVED)

    p.log.info('Custom Field Details:')

    const table = createDetailsTable()

    table.push(
      ['ID', result.uid.toString()],
      ['Name', result.name],
      ['Type', result.type],
      ['Slug', result.slug],
    )

    if (result.description) {
      table.push(['Description', result.description])
    }

    if (result.options && result.options.length > 0) {
      table.push(['Options', result.options.join(', ')])
    }

    if (result.entityTypes && result.entityTypes.length > 0) {
      table.push(['Entity Types', result.entityTypes.join(', ')])
    }

    console.log(table.toString())
    p.log.info('')
  }
  catch (error) {
    spinner.stop(cliMessages.FIELD_RETRIEVE_FAILED)
    throw error
  }
}
