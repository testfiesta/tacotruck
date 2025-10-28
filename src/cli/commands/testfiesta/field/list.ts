import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createListTable } from '../../../../utils/table'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetCustomFieldArgs extends BaseArgs {
  project: string
  token: string
  organization: string
  verbose?: boolean
  limit?: number
  offset?: number
}

export function fieldListCommand() {
  return new Commander.Command('field:list')
    .description(cliDescriptions.FIELD_LIST)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-l, --limit <limit>', cliOptions.LIMIT, cliDefaults.LIMIT)
    .option('--offset <offset>', cliOptions.OFFSET, cliDefaults.OFFSET)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListCustomFields(args).catch((e) => {
        p.log.error('Failed to list custom fields')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runListCustomFields(args: GetCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_FIELDS)
    const result = await tfClient.getCustomFields(args.project, {
      limit: args.limit ? Number.parseInt(args.limit.toString()) : 10,
      offset: args.offset ? Number.parseInt(args.offset.toString()) : 0,
    })
    spinner.stop(cliMessages.FIELDS_RETRIEVED)

    if (result.items && result.items.length > 0) {
      p.log.info(`Found ${result.count} custom fields (showing ${result.items.length}):`)
      const table = createListTable(
        ['ID', 'Name', 'Type', 'Description'],
        [10, 30, 15, 40],
      )

      result.items.forEach((field) => {
        table.push([
          String(field.uid),
          field.name,
          field.type,
          field.description || '',
        ])
      })

      console.log(table.toString())
      p.log.info('')

      if (result.nextOffset) {
        p.log.info(`\nUse --offset ${result.nextOffset} to see more results`)
      }
    }
    else {
      p.log.info(cliMessages.NO_FIELDS_FOUND)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.FIELDS_RETRIEVE_FAILED)
    throw error
  }
}
