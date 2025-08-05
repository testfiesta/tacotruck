import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaETL } from '../../../controllers/testfiesta-etl'
import { getLogger, initializeLogger, setVerbose } from '../../../utils/logger'

interface DeleteProjectArgs {
  projectId: string
  token: string
  organization: string
  verbose?: boolean
}

export function deleteProjectCommand() {
  const deleteProjectCommand = new Commander.Command('project:delete')
    .description('Delete a project in TestFiesta')
    .requiredOption('-i, --project-id <id>', 'TestFiesta project id to delete')
    .requiredOption('-t, --token <token>', 'TestFiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: DeleteProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteProject(args)
    })

  return deleteProjectCommand
}

export async function runDeleteProject(args: DeleteProjectArgs): Promise<void> {
  const logger = getLogger()
  logger.debug('Deleting project in TestFiesta', { projectKey: args.projectId })

  const spinner = p.spinner()
  spinner.start(`Deleting TestFiesta project with key ${args.projectId}`)

  try {
    const testFiestaETL = await TestFiestaETL.fromConfig({
      credentials: {
        token: args.token,
        handle: args.organization,
        project_id: args.projectId,
      },
      etlOptions: {
        baseUrl: 'http://localhost:5000',
        enablePerformanceMonitoring: false,
        strictMode: false,
        retryAttempts: 3,
        timeout: 30000,
        verbose: args.verbose,
      },
    })

    await testFiestaETL.deleteProject()

    spinner.stop()
    p.log.success(`Successfully deleted TestFiesta project with key ${args.projectId}`)
  }
  catch (error) {
    spinner.stop()
    p.log.error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
