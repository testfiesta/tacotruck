import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface UpdateTemplateArgs extends BaseArgs {
  project: string
  id: string
  name?: string
  description?: string
  content?: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function templateUpdateCommand() {
  return new Commander.Command('template:update')
    .description(cliDescriptions.TEMPLATE_UPDATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --id <id>', cliOptions.TEMPLATE_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-n, --name <n>', cliOptions.TEMPLATE_NAME)
    .option('-d, --description <description>', cliOptions.TEMPLATE_DESCRIPTION)
    .option('-c, --content <content>', cliOptions.TEMPLATE_CONTENT)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: UpdateTemplateArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runUpdateTemplate(args)
    })
}

async function runUpdateTemplate(args: UpdateTemplateArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.UPDATING_TEMPLATE)

    const templateId = Number.parseInt(args.id, 10)
    if (Number.isNaN(templateId)) {
      spinner.stop(cliMessages.TEMPLATE_UPDATE_FAILED)
      p.log.error('Template ID must be a number')
      return
    }

    if (!args.name && !args.description && !args.content) {
      spinner.stop(cliMessages.TEMPLATE_UPDATE_FAILED)
      p.log.error(cliMessages.NO_UPDATES_PROVIDED)
      return
    }

    const templateData: any = {}

    if (args.name) {
      templateData.name = args.name
    }

    if (args.description || args.content) {
      templateData.customFields = {
        templateFields: [],
      }

      if (args.description) {
        templateData.customFields.templateFields.push({
          name: 'description',
          dataType: 'text',
        })
      }

      if (args.content) {
        templateData.customFields.templateFields.push({
          name: 'content',
          dataType: 'text',
        })
      }
    }

    console.log(`Updating template ${templateId} in project ${args.project}`)
    console.log(`Template data: ${JSON.stringify(templateData)}`)

    const result = await tfClient.updateTemplate(args.project, templateId, templateData)
    spinner.stop(cliMessages.TEMPLATE_UPDATED)

    p.log.success(`Template "${result.name}" updated successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.TEMPLATE_UPDATE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
