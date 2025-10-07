import type { CreateMilestoneInput } from '../../../../schemas/testfiesta'
import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface CreateMilestoneArgs extends BaseArgs {
  project: string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  token: string
  url: string
  organization: string
  interactive?: boolean
  verbose?: boolean
}

export function milestoneCreateCommand() {
  return new Commander.Command('milestone:create')
    .description(cliDescriptions.MILESTONE_CREATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-n, --name <n>', cliOptions.MILESTONE_NAME)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-s, --start-date <startDate>', cliOptions.MILESTONE_START_DATE)
    .option('-e, --end-date <endDate>', cliOptions.MILESTONE_END_DATE)
    .option('--interactive', 'Use interactive mode to select dates')
    .option('-d, --description <description>', cliOptions.MILESTONE_DESCRIPTION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: CreateMilestoneArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateMilestone(args)
    })
}

async function runCreateMilestone(args: CreateMilestoneArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  let startDate = args.startDate
  let endDate = args.endDate

  if (args.interactive || (!startDate || !endDate)) {
    p.log.info('Interactive date selection mode')

    if (!startDate) {
      const today = new Date()
      const defaultDate = today.toISOString().split('T')[0]

      const startDateInput = await p.text({
        message: 'Enter start date (YYYY-MM-DD):',
        placeholder: defaultDate,
        validate: (value) => {
          if (!value)
            return 'Start date is required'
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
            return 'Invalid date format. Use YYYY-MM-DD'
        },
      })

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
      const defaultEndDateStr = defaultEndDate.toISOString().split('T')[0]

      const endDateInput = await p.text({
        message: 'Enter end date (YYYY-MM-DD):',
        placeholder: defaultEndDateStr,
        validate: (value) => {
          if (!value)
            return 'End date is required'
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
            return 'Invalid date format. Use YYYY-MM-DD'

          if (startDate) {
            const start = new Date(startDate)
            const end = new Date(value)
            if (end < start)
              return 'End date must be after start date'
          }
        },
      })

      if (p.isCancel(endDateInput)) {
        p.cancel('Operation cancelled')
        return
      }

      endDate = endDateInput as string
    }
  }

  if (!startDate || !endDate) {
    p.log.error('Start date and end date are required')
    return
  }

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.CREATING_MILESTONE)

    const milestoneData: CreateMilestoneInput = {
      name: args.name,
      // TODO: Add dynamic status
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
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
