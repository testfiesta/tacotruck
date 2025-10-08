import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface DeleteTemplateArgs extends BaseArgs {
  project: string
  id: string
  token: string
  url: string
  organization: string
  nonInteractive?: boolean
  verbose?: boolean
}

export function templateDeleteCommand() {
  return new Commander.Command('template:delete')
    .description(cliDescriptions.TEMPLATE_DELETE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --id <id>', cliOptions.TEMPLATE_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-y, --non-interactive', cliOptions.NON_INTERACTIVE)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: DeleteTemplateArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runDeleteTemplate(args).catch((e) => {
        p.log.error('Failed to delete template')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runDeleteTemplate(args: DeleteTemplateArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    const templateId = Number.parseInt(args.id, 10)
    if (Number.isNaN(templateId)) {
      p.log.error('Template ID must be a number')
      return
    }

    spinner.start(cliMessages.FETCHING_TEMPLATE)
    const template = await tfClient.getTemplate(args.project, templateId)
    spinner.stop()

    if (!args.nonInteractive) {
      const confirmation = await p.confirm({
        message: `${cliMessages.CONFIRM_DELETE_TEMPLATE} "${template.name}" (ID: ${template.uid})?`,
      })

      if (!confirmation) {
        p.log.info(cliMessages.DELETE_CANCELLED)
        return
      }
    }

    spinner.start(cliMessages.DELETING_TEMPLATE)
    await tfClient.deleteTemplate(args.project, templateId)
    spinner.stop(cliMessages.TEMPLATE_DELETED)

    p.log.success(`Template "${template.name}" deleted successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.TEMPLATE_DELETE_FAILED)
    throw error
  }
}
