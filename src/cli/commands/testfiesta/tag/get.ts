import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createDetailsTable } from '../../../../utils/table'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetTagArgs extends BaseArgs {
  tagId: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function tagGetCommand() {
  return new Commander.Command('tag:get')
    .description(cliDescriptions.TAG_GET)
    .requiredOption('-i, --tag-id <tagId>', cliOptions.TAG_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetTagArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runGetTag(args).catch((e) => {
        p.log.error('Failed to get tag')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runGetTag(args: GetTagArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_TAG)
    const result = await tfClient.getTag(Number.parseInt(args.tagId))
    spinner.stop(cliMessages.TAG_RETRIEVED)

    p.log.info('Tag Details:')

    const table = createDetailsTable()

    table.push(
      ['ID', result.uid.toString()],
      ['Name', result.name],
    )

    if (result.description) {
      table.push(['Description', result.description])
    }

    if (result.color) {
      table.push(['Color', result.color])
    }

    if (result.createdAt) {
      table.push(['Created', new Date(result.createdAt).toLocaleString()])
    }

    if (result.updatedAt) {
      table.push(['Updated', new Date(result.updatedAt).toLocaleString()])
    }

    console.log(table.toString())
    p.log.info('')
  }
  catch (error) {
    spinner.stop(cliMessages.TAG_RETRIEVE_FAILED)
    throw error
  }
}
