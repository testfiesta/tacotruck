import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createDetailsTable, createListTable } from '../../../../utils/table'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetTemplateArgs extends BaseArgs {
  project: string
  id: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function templateGetCommand() {
  return new Commander.Command('template:get')
    .description(cliDescriptions.TEMPLATE_GET)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --id <id>', cliOptions.TEMPLATE_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetTemplateArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runGetTemplate(args).catch((e) => {
        p.log.error('Failed to get template')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runGetTemplate(args: GetTemplateArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_TEMPLATE)

    const templateId = Number.parseInt(args.id, 10)
    if (Number.isNaN(templateId)) {
      spinner.stop(cliMessages.TEMPLATE_RETRIEVE_FAILED)
      p.log.error('Template ID must be a number')
      return
    }

    const result = await tfClient.getTemplate(args.project, templateId)
    spinner.stop(cliMessages.TEMPLATE_RETRIEVED)

    p.log.info('Template data:')

    const basicTable = createDetailsTable()

    basicTable.push(
      ['ID', result.uid.toString()],
      ['Name', result.name],
      ['Project ID', result.projectUid.toString()],
      ['Entity Type', result.entityType],
      ['Is Default', result.isDefault ? 'Yes' : 'No'],
      ['Created By', result.createdBy],
      ['Created At', result.createdAt],
      ['Updated At', result.updatedAt],
    )

    console.log(basicTable.toString())

    if (result.customFields) {
      const templateFields = Array.isArray(result.customFields)
        ? result.customFields
        : result.customFields.templateFields || []

      if (templateFields.length > 0) {
        p.log.info('\nTemplate Fields:')

        const fieldsTable = createListTable(['Field Name', 'Data Type'])

        for (const field of templateFields) {
          fieldsTable.push([field.name, field.dataType])
        }

        console.log(fieldsTable.toString())
      }
    }

    p.log.info('')
  }
  catch (error) {
    spinner.stop(cliMessages.TEMPLATE_RETRIEVE_FAILED)
    throw error
  }
}
