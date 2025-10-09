import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createListTable } from '../../../../utils/table'

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
      await runGetProjects(args).catch((e) => {
        p.log.error('Failed to list projects')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
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
    const result = await tfClient.getProjects({
      limit: args.limit ? Number.parseInt(args.limit.toString()) : 10,
      offset: args.offset ? Number.parseInt(args.offset.toString()) : 0,
    })
    spinner.stop('Projects retrieved successfully')

    result.match({
      ok: (data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          p.log.info(`Found ${data.length} projects:`)
          const table = createListTable(
            ['ID', 'Key', 'Name', 'Description'],
            [10, 15, 30, 40],
          )

          data.forEach((project: any) => {
            table.push([
              String(project.uid || ''),
              project.key || '',
              project.name || '',
              project.description || '',
            ])
          })

          console.log(table.toString())
          p.log.info('')
        }
        else {
          p.log.info('No projects found')
        }
      },
      err: (error) => {
        throw error
      },
    })
  }
  catch (error) {
    spinner.stop('Failed to retrieve projects')
    throw error
  }
}
