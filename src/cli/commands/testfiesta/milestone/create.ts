import type { CreateMilestoneInput } from '../../../../schemas/testfiesta'
import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { formatDateYYYYMMDD, promptForDate, validateEndDate } from '../../../../utils/date-input'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface CreateMilestoneArgs extends BaseArgs {
  project: string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  token: string
  organization: string
  nonInteractive?: boolean
  verbose?: boolean
}

export function milestoneCreateCommand() {
  return new Commander.Command('milestone:create')
    .description(cliDescriptions.MILESTONE_CREATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-n, --name <n>', cliOptions.MILESTONE_NAME)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-s, --start-date <startDate>', cliOptions.MILESTONE_START_DATE)
    .option('-e, --end-date <endDate>', cliOptions.MILESTONE_END_DATE)
    .option('--no-interactive', cliOptions.MILESTONE_NON_INTERACTIVE)
    .option('-d, --description <description>', cliOptions.MILESTONE_DESCRIPTION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: CreateMilestoneArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateMilestone(args).catch((e) => {
        p.log.error('Failed to create milestone')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runCreateMilestone(args: CreateMilestoneArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  let startDate = args.startDate
  let endDate = args.endDate

  const isInteractive = !args.nonInteractive && (!startDate || !endDate)

  if (isInteractive) {
    p.log.info('Interactive date selection mode')

    if (!startDate) {
      const startDateInput = await promptForDate('Enter start date (YYYY-MM-DD):')

      if (p.isCancel(startDateInput)) {
        p.cancel('Operation cancelled')
        return
      }

      startDate = startDateInput as string
    }

    if (!endDate) {
      const startDateObj = new Date(startDate as string)
      const defaultEndDate = new Date(startDateObj)
      defaultEndDate.setDate(defaultEndDate.getDate() + 30)

      const endDateInput = await promptForDate(
        'Enter end date (YYYY-MM-DD):',
        defaultEndDate,
        value => startDate ? validateEndDate(startDate, value) : undefined,
      )

      if (p.isCancel(endDateInput)) {
        p.cancel('Operation cancelled')
        return
      }

      endDate = endDateInput as string
    }
  }

  if (!isInteractive && (!startDate || !endDate)) {
    throw new Error('Start date and end date are required')
  }

  if (!startDate) {
    startDate = formatDateYYYYMMDD(new Date())
  }

  if (!endDate) {
    const startDateObj = new Date(startDate)
    const defaultEndDate = new Date(startDateObj)
    defaultEndDate.setDate(defaultEndDate.getDate() + 30)
    endDate = formatDateYYYYMMDD(defaultEndDate)
  }

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.CREATING_MILESTONE)

    const milestoneData: CreateMilestoneInput = {
      name: args.name,
      status: 1,
      startDate,
      dueAt: endDate,
    }

    if (args.description) {
      milestoneData.description = args.description
    }

    const result = await tfClient.createMilestone(args.project, milestoneData)
    spinner.stop(cliMessages.MILESTONE_CREATED)
    p.log.success(`Milestone "${result.name}" created with name: ${result.name}`)
  }
  catch (error) {
    spinner.stop(cliMessages.MILESTONE_CREATE_FAILED)
    throw error
  }
}
