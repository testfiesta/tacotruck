import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface DeleteMilestoneArgs extends BaseArgs {
  project: string
  id: string
  token: string
  organization: string
  nonInteractive?: boolean
  verbose?: boolean
}

export function milestoneDeleteCommand() {
  return new Commander.Command('milestone:delete')
    .description(cliDescriptions.MILESTONE_DELETE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --id <id>', cliOptions.MILESTONE_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-y, --non-interactive', cliOptions.NON_INTERACTIVE)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: DeleteMilestoneArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteMilestone(args).catch((e) => {
        p.log.error('Failed to delete milestone')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runDeleteMilestone(args: DeleteMilestoneArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    const milestoneId = Number.parseInt(args.id, 10)
    if (Number.isNaN(milestoneId)) {
      p.log.error('Milestone ID must be a number')
      return
    }

    spinner.start(cliMessages.FETCHING_MILESTONE)
    const milestone = await tfClient.getMilestone(args.project, milestoneId)
    spinner.stop()

    if (!args.nonInteractive) {
      const confirmation = await p.confirm({
        message: `${cliMessages.CONFIRM_DELETE_MILESTONE} "${milestone.name}" (ID: ${milestone.id})?`,
      })

      if (!confirmation) {
        p.log.info(cliMessages.DELETE_CANCELLED)
        return
      }
    }

    spinner.start(cliMessages.DELETING_MILESTONE)
    await tfClient.deleteMilestone(args.project, milestoneId)
    spinner.stop(cliMessages.MILESTONE_DELETED)

    p.log.success(`Milestone "${milestone.name}" deleted successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.MILESTONE_DELETE_FAILED)
    throw error
  }
}
