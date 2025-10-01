import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetTagArgs extends BaseArgs {
  token: string
  url: string
  organization: string
  verbose?: boolean
  limit?: number
  offset?: number
}

export function tagListCommand() {
  return new Commander.Command('tag:list')
    .description(cliDescriptions.TAG_LIST)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-l, --limit <limit>', cliOptions.LIMIT, cliDefaults.LIMIT)
    .option('--offset <offset>', cliOptions.OFFSET, cliDefaults.OFFSET)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetTagArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runListTags(args)
    })
}

async function runListTags(args: GetTagArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
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
      result.items.forEach((tag: any) => {
        const colorIndicator = tag.color ? `🎨 ${tag.color}` : ''
        p.log.info(`  • ${tag.name} (${tag.id}) ${colorIndicator}`)
        if (tag.description) {
          p.log.info(`    Description: ${tag.description}`)
        }
      })

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
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
