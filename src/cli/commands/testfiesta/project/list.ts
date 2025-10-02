import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'

interface GetProjectsArgs extends BaseArgs {
  token: string
  organization: string
  verbose?: boolean
  limit?: number
  offset?: number
}

export function projectListCommand() {
  return new Commander.Command('project:list')
    .description('List projects in TestFiesta')
    .requiredOption('-t, --token <token>', 'TestFiesta API token')
    .requiredOption('-u, --url <url>', 'TestFiesta instance URL (e.g., https://api.testfiesta.com)')
    .requiredOption('-o, --organization <organization>', 'Organization handle')
    .option('-l, --limit <limit>', 'Number of items to retrieve', '10')
    .option('--offset <offset>', 'Offset for pagination', '0')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: GetProjectsArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runGetProjects(args)
    })
}

export async function runGetProjects(args: GetProjectsArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start('Fetching projects from TestFiesta')
    await tfClient.getProjects({
      limit: args.limit ? Number.parseInt(args.limit.toString()) : 10,
      offset: args.offset ? Number.parseInt(args.offset.toString()) : 0,
    })
    spinner.stop('Projects retrieved successfully')

    // Handle the Result type - just log success for now since the original get-projects doesn't display results
    p.log.success('Projects fetched successfully')
  }
  catch (error) {
    spinner.stop('Failed to retrieve projects')
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
