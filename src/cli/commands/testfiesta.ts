import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaETL } from '../../controllers/testfiesta-etl'
import { loadCredentials } from '../../utils/enhanced-config-loader'
import { loadRunData } from '../../utils/run-data-loader'

interface SubmitRunArgs {
  data: string
  credentials: string
  projectKey: string
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('submit test run to TestFiesta')
    .requiredOption('-d, --data <path>', 'path to test run data JSON file')
    .requiredOption('-k, --project-key <projectKey>', 'TestFiesta project key')
    .option('-c, --credentials <path>', 'path to credentials JSON file')
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
    let credentials: Record<string, any> | undefined
    if (args.credentials) {
      credentials = loadCredentials('testfiesta', 'target', args.credentials).match({
        ok: creds => ({ testfiesta: { target: creds } }),
        err: error => handleError(error, 'Credentials validation error'),
      }) || undefined

      if (credentials === null)
        return
    }
    const handle = 'temp_handel'
    console.log('@@@ 1111', args.projectKey)

    const testFiestaETL = await TestFiestaETL.fromConfig({ credentials, params: { projectKey: args.projectKey, handle } })

    const runData = loadRunData(args.data).match({
      ok: data => data,
      err: error => handleError(error, 'Data error'),
    })

    if (runData === null)
      return

    const result = await testFiestaETL.submitTestRun(runData)

    spinner.stop()
    p.log.success('Test run submitted successfully')
    p.log.info(`Result: ${JSON.stringify(result, null, 2)}`)
  }
  catch (error) {
    spinner.stop()
    p.log.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
  }
}
