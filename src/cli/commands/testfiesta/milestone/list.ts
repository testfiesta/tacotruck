import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface ListMilestonesArgs extends BaseArgs {
  project: string
  token: string
  url: string
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
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-l, --limit <limit>', cliOptions.LIMIT, cliDefaults.LIMIT)
    .option('--offset <offset>', cliOptions.OFFSET, cliDefaults.OFFSET)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: ListMilestonesArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListMilestones(args)
    })
}

async function runListMilestones(args: ListMilestonesArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
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

    console.dir(result, { depth: null, colors: true })
    p.log.info('')

    if (result.items.length === limit) {
      p.log.info(`${cliMessages.USE_OFFSET} ${offset + limit} ${cliMessages.TO_SEE_MORE}`)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.MILESTONES_RETRIEVE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
