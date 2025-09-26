import type { TRProgressCallbacks } from '../../../clients/testrail'
import type { BaseArgs } from '../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestRailClient } from '../../../clients/testrail'
import { initializeLogger, setVerbose } from '../../../utils/logger'
import { loadRunData } from '../../../utils/run-data-loader'

interface SubmitRunArgs extends BaseArgs {
  data: string
  token: string
  organization: string
  projectId: string
  name: string
  description?: string
  suiteId?: string
  includeAll?: boolean
  caseIds?: number
  verbose?: boolean
}

export function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to TestRail')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file')
    .requiredOption('-t, --token <token>', 'TestRail API token. Use username:password format')
    .requiredOption('-u, --url <url>', 'TestRail instance URL (e.g., https://example.testrail.io)')
    .requiredOption('-p, --project <projectId>', 'TestRail project ID')
    .requiredOption('-n, --name <name>', 'Name for the test run')
    .option('-D, --x <text>', 'Description for the test run')
    .option('-s, --suite-id <id>', 'TestRail suite ID (required for projects with multiple test suites)')
    .option('-a, --include-all', 'Include all test cases in the run')
    .option('-c, --case-ids <ids>', 'Comma-separated list of case IDs to include (only if --include-all is not set)')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: SubmitRunArgs) => {
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

export async function run(args: SubmitRunArgs): Promise<void> {
  const handleError = (error: Error, context: string): null => {
    p.log.error(`${context}: ${error.message}`)
    return null
  }

  try {
    const testRailClient = new TestRailClient({
      baseUrl: args.url,
      apiKey: args.token,
    })

    const runData = loadRunData(args.data).match({
      ok: data => data,
      err: error => handleError(error, 'Data error'),
    })

    if (runData === null)
      return

    const spinner = p.spinner()

    const callbacks: TRProgressCallbacks = {
      onStart: (message) => {
        spinner.start(message)
      },
      onSuccess: (message) => {
        spinner.stop(message)
      },
      onError: (message, error) => {
        spinner.stop(`${message}: ${error?.message || 'Unknown error'}`)
      },
      onProgress: (current, total, label) => {
        spinner.message(`Processing  ${label}: ${current}/${total}`)
      },
    }

    await testRailClient.submitTestResults(runData, { project_id: args.projectId }, args.name, undefined, callbacks)
    p.log.success('Successfully submitted result to TestRail')
  }
  catch (error) {
    handleError(error instanceof Error ? error : new Error(String(error)), 'TestRail API error')
  }
}
