import type { TFHooks } from '../../../clients/testfiesta'
import type { BaseArgs } from '../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../utils/logger'
import { createSpinner } from '../../../utils/spinner'
import { cliDefaults, cliOptions } from './constants'

interface SubmitRunArgs extends BaseArgs {
  data: string
  token: string
  organization: string
  name: string
  project: string
  source?: string
  verbose?: boolean
}

export function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to testfiesta')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file or glob pattern (e.g., "test-results/**/*.xml")')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .requiredOption('-p, --project <project>', 'Project key')
    .requiredOption('-n, --name <name>', 'Name for the test run')
    .option('-u, --url <url>', cliOptions.URL)
    .option('-s, --source <source>', 'Source identifier for the test run (default: "junit-xml")')
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
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()

  const hooks: TFHooks = {
    onStart: (message) => {
      spinner.start(message)
    },
    onSuccess: (message) => {
      spinner.stop(message)
    },
    onProgress: (current, total, label) => {
      spinner.message(`Processing ${label}: ${current}/${total}`)
    },
  }

  await tfClient.submitTestResults(args.project, args.data, { runName: args.name, source: args.source }, hooks)
  p.log.success('Test run submitted successfully to TestFiesta')
}
