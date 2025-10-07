import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface UpdateMilestoneArgs extends BaseArgs {
  project: string
  id: string
  name?: string
  description?: string
  startDate?: string
  endDate?: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function milestoneUpdateCommand() {
  return new Commander.Command('milestone:update')
    .description(cliDescriptions.MILESTONE_UPDATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --id <id>', cliOptions.MILESTONE_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-n, --name <n>', cliOptions.MILESTONE_NAME)
    .option('-d, --description <description>', cliOptions.MILESTONE_DESCRIPTION)
    .option('--start-date <startDate>', cliOptions.MILESTONE_START_DATE)
    .option('--end-date <endDate>', cliOptions.MILESTONE_END_DATE)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: UpdateMilestoneArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runUpdateMilestone(args)
    })
}

async function runUpdateMilestone(args: UpdateMilestoneArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.UPDATING_MILESTONE)

    const milestoneId = Number.parseInt(args.id, 10)
    if (Number.isNaN(milestoneId)) {
      spinner.stop(cliMessages.MILESTONE_UPDATE_FAILED)
      p.log.error('Milestone ID must be a number')
      return
    }

    if (!args.name && !args.description && !args.startDate && !args.endDate) {
      spinner.stop(cliMessages.MILESTONE_UPDATE_FAILED)
      p.log.error(cliMessages.NO_UPDATES_PROVIDED)
      return
    }

    const milestoneData: any = {}

    if (args.name) {
      milestoneData.name = args.name
    }

    if (args.description) {
      milestoneData.description = args.description
    }

    if (args.startDate) {
      milestoneData.startDate = args.startDate
    }

    if (args.endDate) {
      milestoneData.endDate = args.endDate
    }

    console.log(`Updating milestone ${milestoneId} with data:`, milestoneData)
    await tfClient.updateMilestone(args.project, milestoneId, milestoneData)
    spinner.stop(cliMessages.MILESTONE_UPDATED)

    p.log.success(`Milestone updated successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.MILESTONE_UPDATE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
