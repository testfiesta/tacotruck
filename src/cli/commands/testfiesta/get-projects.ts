import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../utils/logger'

interface GetProjectsArgs {
  token: string
  handle: string
  verbose?: boolean
  customFields?: string
}

export function getProjectsCommand() {
  const submitRunCommand = new Commander.Command('project:get')
    .description('Get projects in Testfiesta')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --handle <handle>', 'Organization handle')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: GetProjectsArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runGetProjects(args)
    })

  return submitRunCommand
}

export async function runGetProjects(args: GetProjectsArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    domain: 'https://staging.api.testfiesta.com',
  })
  const spinner = p.spinner()
  try {
    spinner.start('Getting projects in TestFiesta')
    await tfClient.getProjects({ handle: args.handle }, {
      limit: 10,
      // offset: 0,
    })
    spinner.stop('Projects fetched successfully')
  }
  catch (error) {
    spinner.stop('Getting projects failed')
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
