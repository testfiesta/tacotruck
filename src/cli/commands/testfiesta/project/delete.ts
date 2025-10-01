import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { getLogger, initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliOptions } from '../constants'

interface DeleteProjectArgs extends BaseArgs {
  projectKey: string
  token: string
  organization: string
  verbose?: boolean
}

export function projectDeleteCommand() {
  return new Commander.Command('project:delete')
    .description(cliDescriptions.PROJECT_DELETE)
    .requiredOption('-k, --project-key <key>', cliOptions.PROJECT_KEY)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-h, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: DeleteProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteProject(args)
    })
}

export async function runDeleteProject(args: DeleteProjectArgs): Promise<void> {
  const logger = getLogger()
  logger.debug('Deleting project in TestFiesta', { projectKey: args.projectKey })

  const spinner = createSpinner()
  spinner.start(`Deleting TestFiesta project with key ${args.projectKey}`)

  try {
    const tfClient = new TestFiestaClient({
      apiKey: args.token,
      baseUrl: args.url,
      organizationHandle: args.organization,
    })

    await tfClient.deleteProject(args.projectKey)
    spinner.stop(`Project ${args.projectKey} deleted successfully`)
  }
  catch (error) {
    spinner.stop('Project deletion failed')
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
