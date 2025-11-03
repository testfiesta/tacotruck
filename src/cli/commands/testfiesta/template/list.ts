import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createListTable } from '../../../../utils/table'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface ListTemplatesArgs extends BaseArgs {
  project: string
  token: string
  organization: string
  limit?: string
  offset?: string
  verbose?: boolean
}

export function templateListCommand() {
  return new Commander.Command('template:list')
    .description(cliDescriptions.TEMPLATE_LIST)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-l, --limit <limit>', cliOptions.LIMIT, cliDefaults.LIMIT)
    .option('--offset <offset>', cliOptions.OFFSET, cliDefaults.OFFSET)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: ListTemplatesArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListTemplates(args).catch((e) => {
        p.log.error('Failed to list templates')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runListTemplates(args: ListTemplatesArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_TEMPLATES)

    const limit = Number.parseInt(args.limit || cliDefaults.LIMIT, 10)
    const offset = Number.parseInt(args.offset || cliDefaults.OFFSET, 10)

    const result = await tfClient.getTemplates(args.project, { limit, offset })
    spinner.stop(cliMessages.TEMPLATES_RETRIEVED)

    if (result.items.length === 0) {
      p.log.info(cliMessages.NO_TEMPLATES_FOUND)
      return
    }

    p.log.info(`Templates for project ${args.project}:`)

    const table = createListTable(
      ['ID', 'Name', 'Entity Type', 'Default', 'Fields Count'],
      [10, 30, 15, 10, 15],
    )

    for (const template of result.items) {
      let fieldsCount = 0
      if (template.customFields) {
        if (Array.isArray(template.customFields)) {
          fieldsCount = template.customFields.length
        }
        else if (template.customFields.templateFields) {
          fieldsCount = template.customFields.templateFields.length
        }
      }

      table.push([
        template.uid.toString(),
        template.name,
        template.entityType || 'N/A',
        template.isDefault ? 'Yes' : 'No',
        fieldsCount.toString(),
      ])
    }

    console.log(table.toString())
    p.log.info('')

    if (result.items.length === limit) {
      p.log.info(`${cliMessages.USE_OFFSET} ${offset + limit} ${cliMessages.TO_SEE_MORE}`)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.TEMPLATES_RETRIEVE_FAILED)
    throw error
  }
}
