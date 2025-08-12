import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestRailClient } from '../../../clients/testrail'
import { getLogger, initializeLogger, setVerbose } from '../../../utils/logger'

interface DeleteProjectArgs {
  projectId: string
  email: string
  password: string
  url: string
  verbose?: boolean
  force?: boolean
}

export function deleteProjectCommand() {
  const deleteProjectCommand = new Commander.Command('project:delete')
    .description('Delete a project in TestRail')
    .requiredOption('-i, --project-id <id>', 'TestRail project ID to delete')
    .requiredOption('-e, --email <email>', 'TestRail email/username')
    .requiredOption('-p, --password <password>', 'TestRail password or api key')
    .requiredOption('-u, --url <url>', 'TestRail instance URL (e.g., https://example.testrail.io)')
    .option('-f, --force', 'Skip confirmation prompt')
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
  logger.debug('Deleting project in TestRail', { projectId: args.projectId })

  if (!args.force) {
    const shouldContinue = await p.confirm({
      message: `Are you sure you want to delete project with ID ${args.projectId}? This action cannot be undone.`,
      initialValue: false,
    })

    if (p.isCancel(shouldContinue) || !shouldContinue) {
      p.log.info('Project deletion cancelled')
      return
    }
  }

  const spinner = p.spinner()
  spinner.start(`Deleting TestRail project with ID ${args.projectId}`)

  try {
    const testRailClient = new TestRailClient({
      baseUrl: args.url,
      username: args.email,
      password: args.password,
    })

    await testRailClient.deleteProject({
      project_id: args.projectId,
    })

    spinner.stop()
    p.log.success(`Successfully deleted TestRail project with ID ${args.projectId}`)
  }
  catch (error) {
    spinner.stop()
    p.log.error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`)
  }
}
