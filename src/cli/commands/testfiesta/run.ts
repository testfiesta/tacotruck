import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaETL } from '../../../controllers/testfiesta-etl'
import { loadRunData } from '../../../utils/run-data-loader'

interface SubmitRunArgs {
  data: string
  token: string
  organization: string
  project: string
}

export function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to testfiesta')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .requiredOption('-p, --project <project>', 'Project key')
    .action(async (args: SubmitRunArgs) => {
      await run(args).catch((e) => {
        p.log.error('Failed to submit test run')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })

  return submitRunCommand
}

export async function run(args: SubmitRunArgs): Promise<void> {
  const spinner = p.spinner()
  spinner.start('Submitting test run to TestFiesta')

  const handleError = (error: Error, context: string): null => {
    spinner.stop()
    p.log.error(`${context}: ${error.message}`)
    return null
  }

  const credentials = {
    token: args.token,
    handle: args.organization,
    projectKey: args.project,
  }

  const testFiestaETL = await TestFiestaETL.fromConfig({
    credentials,
    etlOptions: {
      baseUrl: 'http://localhost:5000',
      enablePerformanceMonitoring: true,
      strictMode: false,
      retryAttempts: 1,
      retryDelay: 500,
      timeout: 2000,
    },
  })

  const runData = loadRunData(args.data).match({
    ok: data => data,
    err: error => handleError(error, 'Data error'),
  })

  if (runData === null)
    return

  try {
    const loadResult = await testFiestaETL.load(runData)
    if (loadResult.metadata.errors.length === 0) {
      spinner.stop()
      p.log.success('Test run submitted successfully to TestFiesta')
    }
  }
  catch (error) {
    spinner.stop()
    p.log.error(`Failed to submit test run: ${error instanceof Error ? error.message : String(error)}`)
  }
}
