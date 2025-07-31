import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { initializeLogger, setVerbose } from '../../utils/logger'

interface Args {
  verbose?: boolean
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('submit test run to TestRails')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: Args) => {
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

export function createTestrailsCommand() {
  const trCommand = new Commander.Command('testrails')
    .description('TestRails platform specific commands')
    .addCommand(submitRunCommand())

  return trCommand
}

export async function run(_args: Args) {
  throw new Error('Not implemented')
}
