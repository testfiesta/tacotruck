import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetCustomFieldArgs extends BaseArgs {
  project: string
  token: string
  url: string
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
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-l, --limit <limit>', cliOptions.LIMIT, cliDefaults.LIMIT)
    .option('--offset <offset>', cliOptions.OFFSET, cliDefaults.OFFSET)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListCustomFields(args)
    })
}

async function runListCustomFields(args: GetCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
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
      result.items.forEach((field: any) => {
        p.log.info(`  • ${field.name} (${field.uid}) - Type: ${field.type}`)
        if (field.description) {
          p.log.info(`    Description: ${field.description}`)
        }
      })

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
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
