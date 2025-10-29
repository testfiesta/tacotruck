import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface DeleteTagArgs extends BaseArgs {
  tagId: string
  token: string
  organization: string
  verbose?: boolean
  nonInteractive?: boolean
}

export function tagDeleteCommand() {
  return new Commander.Command('tag:delete')
    .description(cliDescriptions.TAG_DELETE)
    .requiredOption('-i, --tag-id <tagId>', cliOptions.TAG_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .option('--non-interactive', cliOptions.NON_INTERACTIVE)
    .action(async (args: DeleteTagArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteTag(args).catch((e) => {
        p.log.error('Failed to delete tag')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runDeleteTag(args: DeleteTagArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    if (!args.nonInteractive) {
      const shouldDelete = await p.confirm({
        message: `${cliMessages.CONFIRM_DELETE_TAG} "${args.tagId}"?`,
      })

      if (p.isCancel(shouldDelete) || !shouldDelete) {
        p.log.info(cliMessages.DELETE_CANCELLED)
        return
      }
    }
    else {
      p.log.info(`Deleting tag "${args.tagId}" (non-interactive mode)...`)
    }

    spinner.start(cliMessages.DELETING_TAG)
    await tfClient.deleteTag(Number.parseInt(args.tagId))
    spinner.stop(cliMessages.TAG_DELETED)

    p.log.success(`Tag "${args.tagId}" deleted successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.TAG_DELETE_FAILED)
    throw error
  }
}
