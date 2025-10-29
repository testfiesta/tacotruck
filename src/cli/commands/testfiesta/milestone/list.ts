import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createListTable, formatTableValue } from '../../../../utils/table'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface ListMilestonesArgs extends BaseArgs {
  project: string
  token: string
  organization: string
  limit?: string
  offset?: string
  verbose?: boolean
}

export function milestoneListCommand() {
  return new Commander.Command('milestone:list')
    .description(cliDescriptions.MILESTONE_LIST)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-l, --limit <limit>', cliOptions.LIMIT, cliDefaults.LIMIT)
    .option('--offset <offset>', cliOptions.OFFSET, cliDefaults.OFFSET)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: ListMilestonesArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListMilestones(args).catch((e) => {
        p.log.error('Failed to list milestones')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runListMilestones(args: ListMilestonesArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_MILESTONES)

    const limit = Number.parseInt(args.limit || cliDefaults.LIMIT, 10)
    const offset = Number.parseInt(args.offset || cliDefaults.OFFSET, 10)

    const result = await tfClient.getMilestones(args.project, { limit, offset })
    spinner.stop(cliMessages.MILESTONES_RETRIEVED)

    if (result.items.length === 0) {
      p.log.info(cliMessages.NO_MILESTONES_FOUND)
      return
    }

    p.log.info(`Milestones for project ${args.project}:`)

    const table = createListTable(
      ['ID', 'Name', 'Custom Fields'],
      [10, 30, 60],
    )

    for (const milestone of result.items) {
      let customFieldsDisplay = 'None'

      if (milestone.customFields && Object.keys(milestone.customFields).length > 0) {
        customFieldsDisplay = formatTableValue(milestone.customFields)
      }

      table.push([
        milestone.uid.toString(),
        milestone.name,
        customFieldsDisplay,
      ])
    }

    console.log(table.toString())
    p.log.info('')

    if (result.items.length === limit) {
      p.log.info(`${cliMessages.USE_OFFSET} ${offset + limit} ${cliMessages.TO_SEE_MORE}`)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.MILESTONES_RETRIEVE_FAILED)
    throw error
  }
}
