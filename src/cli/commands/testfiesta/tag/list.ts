import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { createListTable } from '../../../../utils/table'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetTagArgs extends BaseArgs {
  token: string
  organization: string
  verbose?: boolean
  limit?: number
  offset?: number
}

export function tagListCommand() {
  return new Commander.Command('tag:list')
    .description(cliDescriptions.TAG_LIST)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-l, --limit <limit>', cliOptions.LIMIT, cliDefaults.LIMIT)
    .option('--offset <offset>', cliOptions.OFFSET, cliDefaults.OFFSET)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetTagArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListTags(args).catch((e) => {
        p.log.error('Failed to list tags')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runListTags(args: GetTagArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_TAGS)
    const result = await tfClient.getTags({
      limit: args.limit ? Number.parseInt(args.limit.toString()) : 10,
      offset: args.offset ? Number.parseInt(args.offset.toString()) : 0,
    })
    spinner.stop(cliMessages.TAGS_RETRIEVED)

    if (result.items && result.items.length > 0) {
      p.log.info(`Found ${result.count} tags (showing ${result.items.length}):`)
      const table = createListTable(
        ['ID', 'Name', 'Color', 'Description'],
        [10, 30, 15, 40],
      )

      result.items.forEach((tag: { uid: number, name: string, color?: string, description?: string }) => {
        table.push([
          tag.uid.toString(),
          tag.name,
          tag.color || '',
          tag.description || '',
        ])
      })

      console.log(table.toString())
      p.log.info('')

      if (result.nextOffset) {
        p.log.info(`\nUse --offset ${result.nextOffset} to see more results`)
      }
    }
    else {
      p.log.info(cliMessages.NO_TAGS_FOUND)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.TAGS_RETRIEVE_FAILED)
    throw error
  }
}
