import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { getLogger, initializeLogger, setVerbose } from '../../../utils/logger'

interface DeleteProjectArgs {
  projectKey: string
  token: string
  organization: string
  verbose?: boolean
}

export function deleteProjectCommand() {
  const deleteProjectCommand = new Commander.Command('project:delete')
    .description('Delete a project in TestFiesta')
    .requiredOption('-k, --project-key <key>', 'TestFiesta project key to delete')
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
  logger.debug('Deleting project in TestFiesta', { projectKey: args.projectKey })

  const spinner = p.spinner()
  spinner.start(`Deleting TestFiesta project with key ${args.projectKey}`)

  try {
    const tfClient = new TestFiestaClient({
      apiKey: args.token,
      domain: 'https://staging.api.testfiesta.com',
      projectKey: args.projectKey,
      organizationHandle: args.organization,
    })

    await tfClient.deleteProject({
      project_id: args.projectKey,
    })

    spinner.stop()
    p.log.success(`Successfully deleted TestFiesta project with key ${args.projectKey}`)
  }
  catch (error) {
    spinner.stop()
    p.log.error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
