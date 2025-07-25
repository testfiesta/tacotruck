import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaETL } from '../../controllers/testfiesta-etl'
import { loadRunData } from '../../utils/run-data-loader'

interface SubmitRunArgs {
  data: string
  token: string
  orgHandle: string
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to testfiesta')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .action(async (args: SubmitRunArgs) => {
      await run(args).catch((e) => {
        p.log.error('Failed to submit test run')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })

  return submitRunCommand
}

export function createTestfiestaCommand() {
  const tfCommand = new Commander.Command('testfiesta')
    .description('TestFiesta platform specific commands')
    .addCommand(submitRunCommand())

  return tfCommand
}

export async function run(args: SubmitRunArgs): Promise<void> {
  const spinner = p.spinner()
  spinner.start('Submitting test run to TestFiesta')

  const handleError = (error: Error, context: string): null => {
    spinner.stop()
    p.log.error(`${context}: ${error.message}`)
    return null
  }

  const testFiestaETL = await TestFiestaETL.fromConfig({
    credentials: { token: args.token, handle: args.orgHandle },
    etlOptions: {
      baseUrl: 'http://localhost:5000',
      enablePerformanceMonitoring: true,
      strictMode: false,
      retryAttempts: 3,
      timeout: 5000,
    },
  })

  const runData = loadRunData(args.data).match({
    ok: data => data,
    err: error => handleError(error, 'Data error'),
  })

  if (runData === null)
    return

  await testFiestaETL.submitMultiTarget(runData)
  spinner.stop()
}
