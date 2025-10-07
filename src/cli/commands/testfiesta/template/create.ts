import type { CreateTemplateInput } from '../../../../schemas/testfiesta'
import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface CreateTemplateArgs extends BaseArgs {
  project: string
  name: string
  description?: string
  content?: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function templateCreateCommand() {
  return new Commander.Command('template:create')
    .description(cliDescriptions.TEMPLATE_CREATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-n, --name <n>', cliOptions.TEMPLATE_NAME)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-d, --description <description>', cliOptions.TEMPLATE_DESCRIPTION)
    .option('-c, --content <content>', cliOptions.TEMPLATE_CONTENT)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: CreateTemplateArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateTemplate(args)
    })
}

async function runCreateTemplate(args: CreateTemplateArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.CREATING_TEMPLATE)

    const templateData: CreateTemplateInput = {
      name: args.name,
      templateFields: [],
    }

    if (args.description) {
      templateData.templateFields!.push({
        name: 'description',
        dataType: 'text',
      })
    }

    if (args.content) {
      templateData.templateFields!.push({
        name: 'content',
        dataType: 'text',
      })
    }

    if (templateData.templateFields!.length === 0) {
      templateData.templateFields = []
    }
    const result = await tfClient.createTemplate(args.project, templateData)
    spinner.stop(cliMessages.TEMPLATE_CREATED)
    p.log.success(`Template "${result.name}" created with ID: ${result.uid}`)
  }
  catch (error) {
    spinner.stop(cliMessages.TEMPLATE_CREATE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
