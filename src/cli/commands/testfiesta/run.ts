import type { TFHooks } from '../../../clients/testfiesta'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../utils/logger'

interface SubmitRunArgs {
  data: string
  token: string
  organization: string
  name: string
  projectKey: string
  url: string
  verbose?: boolean
}

export function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('Submit test run to testfiesta')
    .requiredOption('-d, --data <path>', 'Path to test run data JSON/XML file')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .requiredOption('-p, --project <projectKey>', 'Project key')
    .requiredOption('-n, --name <name>', 'Name for the test run')
    .requiredOption('-u, --url <url>', 'TestFiesta instance URL (e.g., https://api.testfiesta.com)')
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
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = p.spinner()

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

  await tfClient.submitTestResults(args.projectKey, args.data, { runName: args.name }, hooks)
  p.log.success('Test run submitted successfully to TestFiesta')
}
