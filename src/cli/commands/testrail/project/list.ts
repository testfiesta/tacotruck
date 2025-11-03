import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestRailClient } from '../../../../clients/testrail'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createListTable } from '../../../../utils/table'

interface ListProjectsArgs extends BaseArgs {
  token: string
  url: string
  verbose?: boolean
}

export function projectListCommand() {
  return new Commander.Command('project:list')
    .description('List projects in TestRail')
    .requiredOption('-t, --token <token>', 'TestRail API token. Use username:password format')
    .requiredOption('-u, --url <url>', 'TestRail instance URL (e.g., https://example.testrail.io)')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: ListProjectsArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListProjects(args).catch((e) => {
        p.log.error('Failed to list projects')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

export async function runListProjects(args: ListProjectsArgs): Promise<void> {
  const testRailClient = new TestRailClient({
    baseUrl: args.url,
    apiKey: args.token,
  })

  const spinner = createSpinner()
  try {
    spinner.start('Fetching projects from TestRail')
    const data = await testRailClient.listProjects()
    spinner.stop('Projects retrieved successfully')

    if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
      p.log.info(`Found ${data.projects.length} projects:`)
      const table = createListTable(
        ['ID', 'Name', 'Description', 'Suite Mode'],
        [8, 25, 40, 15],
      )

      data.projects.forEach((project: any) => {
        const suiteModeText = project.suite_mode === 1
          ? 'Single'
          : project.suite_mode === 2
            ? 'Single+Baseline'
            : project.suite_mode === 3 ? 'Multiple' : 'Unknown'

        table.push([
          String(project.id || ''),
          project.name || '',
          project.description || '',
          suiteModeText,
        ])
      })

      console.log(table.toString())
      p.log.info('')
    }
    else {
      p.log.info('No projects found')
    }
  }
  catch (error) {
    spinner.stop('Failed to retrieve projects')
    throw error
  }
}
