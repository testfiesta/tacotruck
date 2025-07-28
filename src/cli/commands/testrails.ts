import { Buffer } from 'node:buffer'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestRailETL } from '../../controllers/testrail-etl'
import { loadRunData } from '../../utils/run-data-loader'

interface SubmitRunArgs {
  data: string
  email: string
  apiKey: string
  url: string
  projectId: string
  name?: string
  description?: string
  suiteId?: string
  includeAll?: boolean
  caseIds?: string
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to TestRail')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file')
    .requiredOption('-e, --email <email>', 'TestRail email/username')
    .requiredOption('-k, --api-key <key>', 'TestRail API key')
    .requiredOption('-u, --url <url>', 'TestRail instance URL (e.g., https://example.testrail.io)')
    .requiredOption('-p, --project-id <id>', 'TestRail project ID')
    .option('-n, --name <name>', 'Name for the test run')
    .option('-D, --description <text>', 'Description for the test run')
    .option('-s, --suite-id <id>', 'TestRail suite ID (required for projects with multiple test suites)')
    .option('-a, --include-all', 'Include all test cases in the run')
    .option('-c, --case-ids <ids>', 'Comma-separated list of case IDs to include (only if --include-all is not set)')
    .action(async (args: SubmitRunArgs) => {
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
  spinner.start('Submitting test run to TestRail')

  const handleError = (error: Error, context: string): null => {
    spinner.stop()
    p.log.error(`${context}: ${error.message}`)
    return null
  }

  try {
    // Initialize TestRailETL with credentials and options
    const testRailETL = await TestRailETL.fromConfig({
      credentials: {
        base64Credentials: Buffer.from(`${args.email}:${args.apiKey}`).toString('base64'),
        base_url: args.url,
      },
      etlOptions: {
        baseUrl: args.url,
        enablePerformanceMonitoring: false,
        strictMode: false,
        retryAttempts: 3,
        timeout: 30000,
      },
    })

    // Load test run data
    const runData = loadRunData(args.data).match({
      ok: data => data,
      err: error => handleError(error, 'Data error'),
    })

    if (runData === null)
      return

    await testRailETL.submitTestRun(runData)
    p.log.success(`Successfully created TestRail run `)
  }
  catch (error) {
    handleError(error instanceof Error ? error : new Error(String(error)), 'TestRail API error')
  }
}
