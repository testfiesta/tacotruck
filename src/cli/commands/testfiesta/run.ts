import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../utils/logger'
import { loadRunData } from '../../../utils/run-data-loader'

interface SubmitRunArgs {
  data: string
  token: string
  organization: string
  project: string
  verbose?: boolean
}

export function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to testfiesta')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .requiredOption('-p, --project <project>', 'Project key')
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
  const spinner = p.spinner()
  spinner.start('Submitting test run to TestFiesta')

  const handleError = (error: Error, context: string): null => {
    spinner.stop()
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

  try {
    await tfClient.submitTestResults()
    spinner.stop()
    p.log.success('Test run submitted successfully to TestFiesta')
  }
  catch (error) {
    spinner.stop()
    p.log.error(`Failed to submit test run: ${error instanceof Error ? error.message : String(error)}`)
  }
}
