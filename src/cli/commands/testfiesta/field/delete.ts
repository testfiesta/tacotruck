import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface DeleteCustomFieldArgs extends BaseArgs {
  project: string
  customFieldId: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function fieldDeleteCommand() {
  return new Commander.Command('field:delete')
    .description(cliDescriptions.FIELD_DELETE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --custom-field-id <customFieldId>', cliOptions.FIELD_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: DeleteCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteCustomField(args)
    })
}

async function runDeleteCustomField(args: DeleteCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    const shouldDelete = await p.confirm({
      message: `${cliMessages.CONFIRM_DELETE_FIELD} "${args.customFieldId}"?`,
    })

    if (p.isCancel(shouldDelete) || !shouldDelete) {
      p.log.info(cliMessages.DELETE_CANCELLED)
      return
    }

    spinner.start(cliMessages.DELETING_FIELD)
    await tfClient.deleteCustomField(args.project, args.customFieldId)
    spinner.stop(cliMessages.FIELD_DELETED)

    p.log.success(`Custom field "${args.customFieldId}" deleted successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.FIELD_DELETE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
