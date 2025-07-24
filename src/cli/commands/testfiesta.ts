import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaETL } from '../../controllers/testfiesta-etl'
import { loadRunData } from '../../utils/run-data-loader'

interface SubmitRunArgs {
  data: string
  token: string
  handle: string
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('submit test run to TestFiesta')
    .requiredOption('-d, --data <path>', 'path to test run data JSON file')
    .requiredOption('-t, --token <token>', 'TestFiesta API token')
    .requiredOption('-h, --handle <handle>', 'Organization handle')
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

  try {
    const testFiestaETL = await TestFiestaETL.fromConfig({
      credentials: { token: args.token, handle: args.handle },
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

    await testFiestaETL.submitMultiTarget(runData, 'runs')
    spinner.stop()
  }
  catch (error) {
    spinner.stop()

    if (error instanceof Error) {
      p.log.error(`Submission failed: ${error.message}`)

      if ('type' in error && 'context' in error) {
        p.log.error(`Error type: ${(error as any).type}`)
        if ((error as any).context && Object.keys((error as any).context).length > 0) {
          p.log.error(`Context: ${JSON.stringify((error as any).context, null, 2)}`)
        }

        if ('isRetryable' in error && (error as any).isRetryable) {
          p.log.warn('This error might be retryable - consider running the command again')
        }
      }
    }
    else {
      p.log.error(`Unexpected error: ${String(error)}`)
    }

    process.exit(1)
  }
}
