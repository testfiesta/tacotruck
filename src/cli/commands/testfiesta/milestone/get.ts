import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetMilestoneArgs extends BaseArgs {
  project: string
  id: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function milestoneGetCommand() {
  return new Commander.Command('milestone:get')
    .description(cliDescriptions.MILESTONE_GET)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --id <id>', cliOptions.MILESTONE_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetMilestoneArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runGetMilestone(args)
    })
}

async function runGetMilestone(args: GetMilestoneArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_MILESTONE)

    const milestoneId = Number.parseInt(args.id, 10)
    if (Number.isNaN(milestoneId)) {
      spinner.stop(cliMessages.MILESTONE_RETRIEVE_FAILED)
      p.log.error('Milestone ID must be a number')
      return
    }

    const result = await tfClient.getMilestone(args.project, milestoneId)
    spinner.stop(cliMessages.MILESTONE_RETRIEVED)

    p.log.info('Milestone data:')
    console.dir(result, { depth: null, colors: true })
    p.log.info('')
  }
  catch (error) {
    spinner.stop(cliMessages.MILESTONE_RETRIEVE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
