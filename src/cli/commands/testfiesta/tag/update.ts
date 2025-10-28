import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface UpdateTagArgs extends BaseArgs {
  tagId: string
  name?: string
  description?: string
  color?: string
  token: string
  organization: string
  verbose?: boolean
}

export function tagUpdateCommand() {
  return new Commander.Command('tag:update')
    .description(cliDescriptions.TAG_UPDATE)
    .requiredOption('-i, --tag-id <tagId>', cliOptions.TAG_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-n, --name <name>', cliOptions.TAG_NAME)
    .option('-d, --description <description>', cliOptions.TAG_DESCRIPTION)
    .option('-c, --color <color>', cliOptions.TAG_COLOR)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: UpdateTagArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runUpdateTag(args).catch((e) => {
        p.log.error('Failed to update tag')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runUpdateTag(args: UpdateTagArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.UPDATING_TAG)

    const updateData: any = {}

    if (args.name)
      updateData.name = args.name
    if (args.description !== undefined)
      updateData.description = args.description
    if (args.color) {
      if (!/^#[0-9a-f]{6}$/i.test(args.color)) {
        spinner.stop('Invalid color format')
        p.log.error(cliMessages.INVALID_COLOR_FORMAT)
        return
      }
      updateData.color = args.color
    }

    if (Object.keys(updateData).length === 0) {
      spinner.stop('No updates provided')
      p.log.warn(cliMessages.NO_UPDATES_PROVIDED)
      return
    }

    const result = await tfClient.updateTag(Number.parseInt(args.tagId), updateData)
    spinner.stop(cliMessages.TAG_UPDATED)

    p.log.success(`Tag "${result.name}" (${result.id}) updated successfully`)
  }
  catch (error) {
    spinner.stop(cliMessages.TAG_UPDATE_FAILED)
    throw error
  }
}
