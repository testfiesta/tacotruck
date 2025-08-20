import type { TFProgressCallbacks } from '../../../clients/testfiesta'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../utils/logger'
import { loadRunData } from '../../../utils/run-data-loader'

interface SubmitRunArgs {
  data: string
  token: string
  handle: string
  key: string
  verbose?: boolean
}

export function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to testfiesta')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --handle <handle>', 'Organization handle')
    .requiredOption('-k, --key <key>', 'Project key')
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

  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    domain: 'https://staging.api.testfiesta.com',
  })

  const runData = loadRunData(args.data).match({
    ok: data => data,
    err: error => handleError(error, 'Data error'),
  })

  if (runData === null)
    return

  const spinner = p.spinner()

  const callbacks: TFProgressCallbacks = {
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
      spinner.message(`Processing ${label}: ${current}/${total}`)
    },
  }

  try {
    await tfClient.submitTestResults(runData, { key: args.key, handle: args.handle }, callbacks)
    p.log.success('Test run submitted successfully to TestFiesta')
  }
  catch (error) {
    p.log.error(`Failed to submit test run: ${error instanceof Error ? error.message : String(error)}`)
  }
}
