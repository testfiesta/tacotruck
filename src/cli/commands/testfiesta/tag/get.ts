import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
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
      await runGetTag(args)
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

    p.log.info(`Tag Details:`)
    p.log.info(`  ID: ${result.uid}`)
    p.log.info(`  Name: ${result.name}`)
    if (result.description) {
      p.log.info(`  Description: ${result.description}`)
    }
    if (result.color) {
      p.log.info(`  Color: ${result.color}`)
    }
    if (result.createdAt) {
      p.log.info(`  Created: ${new Date(result.createdAt).toLocaleString()}`)
    }
    if (result.updatedAt) {
      p.log.info(`  Updated: ${new Date(result.updatedAt).toLocaleString()}`)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.TAG_RETRIEVE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
