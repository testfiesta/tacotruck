import * as p from '@clack/prompts'
import * as Commander from 'commander'

interface Args {
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('submit test run to TestFiesta')
    .action(async (args: Args) => {
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

export async function run(_args: Args) {
  throw new Error('Not implemented')
}
