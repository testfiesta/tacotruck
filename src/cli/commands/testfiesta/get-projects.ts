import type { BaseArgs } from '../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../utils/logger'

interface GetProjectsArgs extends BaseArgs {
  token: string
  organization: string
  verbose?: boolean
  limit?: string
  offset?: string
}

export function getProjectsCommand() {
  const submitRunCommand = new Commander.Command('projects:get')
    .description('Get projects in Testfiesta')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .requiredOption('-u, --url <url>', 'TestFiesta instance URL (e.g., https://api.testfiesta.com)')
    .option('-l, --limit <limit>', 'Limit the number of projects to fetch', '10')
    .option('-o, --offset <offset>', 'Offset the number of projects to fetch', '0')
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
    baseUrl: args.url,
    organizationHandle: args.organization,
  })
  const spinner = p.spinner()
  try {
    spinner.start('Getting projects in TestFiesta')
    await tfClient.getProjects({
      limit: Number(args.limit),
      offset: Number(args.offset),
    })
    spinner.stop('Projects fetched successfully')
  }
  catch (error) {
    spinner.stop('Getting projects failed')
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
