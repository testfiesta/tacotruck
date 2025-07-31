import { Buffer } from 'node:buffer'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { initializeLogger, setVerbose } from '../../utils/logger'

interface SubmitRunArgs {
  data: string
  email: string
  password: string
  url: string
  projectId: string
  runName: string
  name?: string
  description?: string
  suiteId?: string
  includeAll?: boolean
  caseIds?: string
  verbose?: boolean
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('submit test run to TestRails')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: Args) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)

      await run(args).catch((e) => {
        p.log.error('Failed to submit test run')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })

  return submitRunCommand
}

export function createTestrailsCommand() {
  const trCommand = new Commander.Command('testrails')
    .description('TestRail platform specific commands')
    .addCommand(submitRunCommand())

  return trCommand
}

export async function run(args: SubmitRunArgs): Promise<void> {
  const spinner = p.spinner()
  spinner.start('Loading test data')

  const handleError = (error: Error, context: string): null => {
    spinner.stop()
    p.log.error(`${context}: ${error.message}`)
    return null
  }

  try {
    const testRailETL = await TestRailETL.fromConfig({
      credentials: {
        base64Credentials: Buffer.from(`${args.email}:${args.password}`).toString('base64'),
        base_url: args.url,
        project_id: args.projectId,
        run_name: args.runName,
      },
      etlOptions: {
        baseUrl: args.url,
        enablePerformanceMonitoring: false,
        strictMode: false,
        retryAttempts: 3,
        timeout: 30000,
      },
    })
    console.log('Loading test data...')

    const runData = loadRunData(args.data).match({
      ok: data => data,
      err: error => handleError(error, 'Data error'),
    })

    if (runData === null)
      return

    spinner.stop()

    console.log('Connecting to TestRail...')
    await testRailETL.submitTestRun(runData)
    p.log.success('Successfully created TestRail run')
  }
  catch (error) {
    handleError(error instanceof Error ? error : new Error(String(error)), 'TestRail API error')
  }
}
