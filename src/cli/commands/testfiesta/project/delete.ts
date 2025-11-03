import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { getLogger, initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface DeleteProjectArgs extends BaseArgs {
  projectKey: string
  token: string
  organization: string
  verbose?: boolean
  nonInteractive?: boolean
}

export function projectDeleteCommand() {
  return new Commander.Command('project:delete')
    .description(cliDescriptions.PROJECT_DELETE)
    .requiredOption('-k, --project-key <key>', cliOptions.PROJECT_KEY)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-h, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .option('--non-interactive', cliOptions.NON_INTERACTIVE)
    .action(async (args: DeleteProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteProject(args).catch((e) => {
        p.log.error('Failed to delete project')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

export async function runDeleteProject(args: DeleteProjectArgs): Promise<void> {
  const logger = getLogger()
  logger.debug('Deleting project in TestFiesta', { projectKey: args.projectKey })

  const spinner = createSpinner()
  try {
    if (!args.nonInteractive) {
      const shouldDelete = await p.confirm({
        message: `${cliMessages.CONFIRM_DELETE_PROJECT} "${args.projectKey}"?`,
      })

      if (p.isCancel(shouldDelete) || !shouldDelete) {
        p.log.info(cliMessages.DELETE_CANCELLED)
        return
      }
    }
    else {
      p.log.info(`Deleting project "${args.projectKey}" (non-interactive mode)...`)
    }

    spinner.start(cliMessages.DELETING_PROJECT)

    const tfClient = new TestFiestaClient({
      apiKey: args.token,
      baseUrl: args.url || cliDefaults.URL,
      organizationHandle: args.organization,
    })

    await tfClient.deleteProject(args.projectKey)
    spinner.stop(cliMessages.PROJECT_DELETED)
  }
  catch (error) {
    spinner.stop(cliMessages.PROJECT_DELETE_FAILED)
    throw error
  }
}
