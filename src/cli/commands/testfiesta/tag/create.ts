import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDefaults, cliDescriptions, cliMessages, cliOptions } from '../constants'

interface CreateTagArgs extends BaseArgs {
  name: string
  description?: string
  color?: string
  token: string
  organization: string
  verbose?: boolean
}

export function tagCreateCommand() {
  return new Commander.Command('tag:create')
    .description(cliDescriptions.TAG_CREATE)
    .requiredOption('-n, --name <name>', cliOptions.TAG_NAME)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .option('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-d, --description <description>', cliOptions.TAG_DESCRIPTION)
    .option('-c, --color <color>', cliOptions.TAG_COLOR)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: CreateTagArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateTag(args).catch((e) => {
        p.log.error('Failed to create tag')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })
}

async function runCreateTag(args: CreateTagArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url || cliDefaults.URL,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.CREATING_TAG)

    const tagData: any = {
      name: args.name,
    }

    if (args.description) {
      tagData.description = args.description
    }
    if (args.color) {
      if (!/^#[0-9a-f]{6}$/i.test(args.color)) {
        spinner.stop('Invalid color format')
        p.log.error(cliMessages.INVALID_COLOR_FORMAT)
        return
      }
      tagData.color = args.color
    }

    const result = await tfClient.createTag(tagData)
    spinner.stop(cliMessages.TAG_CREATED)

    p.log.success(`Tag "${result.name}" created with ID: ${result.uid}`)
    if (result.color) {
      p.log.info(`Color: ${result.color}`)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.TAG_CREATE_FAILED)
    throw error
  }
}
