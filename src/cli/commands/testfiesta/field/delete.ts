import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface DeleteCustomFieldArgs extends BaseArgs {
  project: string
  customFieldId: string
  token: string
  organization: string
  verbose?: boolean
  nonInteractive?: boolean
}

export function fieldDeleteCommand() {
  return new Commander.Command('field:delete')
    .description(cliDescriptions.FIELD_DELETE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --custom-field-id <customFieldId>', cliOptions.FIELD_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .option('--non-interactive', cliOptions.NON_INTERACTIVE)
    .action(async (args: DeleteCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteCustomField(args).catch((e) => {
        p.log.error('Failed to delete custom field')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runDeleteCustomField(args: DeleteCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    if (!args.nonInteractive) {
      const shouldDelete = await p.confirm({
        message: `${cliMessages.CONFIRM_DELETE_FIELD} "${args.customFieldId}"?`,
      })

      if (p.isCancel(shouldDelete) || !shouldDelete) {
        p.log.info(cliMessages.DELETE_CANCELLED)
        return
      }
    }
    else {
      p.log.info(`Deleting custom field "${args.customFieldId}" (non-interactive mode)...`)
    }

    spinner.start(cliMessages.DELETING_FIELD)
    await tfClient.deleteCustomField(args.project, args.customFieldId)
    spinner.stop(cliMessages.FIELD_DELETED)

    p.log.success(`Custom field "${args.customFieldId}" deleted successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.FIELD_DELETE_FAILED)
    throw error
  }
}
