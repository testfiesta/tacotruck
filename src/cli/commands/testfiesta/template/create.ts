import type { CreateTemplateInput } from '../../../../schemas/testfiesta'
import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface CreateTemplateArgs extends BaseArgs {
  project: string
  name: string
  description?: string
  content?: string
  token: string
  organization: string
  verbose?: boolean
}

export function templateCreateCommand() {
  return new Commander.Command('template:create')
    .description(cliDescriptions.TEMPLATE_CREATE)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-n, --name <n>', cliOptions.TEMPLATE_NAME)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-d, --description <description>', cliOptions.TEMPLATE_DESCRIPTION)
    .option('-c, --content <content>', cliOptions.TEMPLATE_CONTENT)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: CreateTemplateArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateTemplate(args).catch((e) => {
        p.log.error('Failed to create template')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runCreateTemplate(args: CreateTemplateArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
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
    throw error
  }
}
