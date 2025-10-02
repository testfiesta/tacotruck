import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliMessages, cliOptions } from '../constants'

interface GetCustomFieldArgs extends BaseArgs {
  project: string
  customFieldId: string
  token: string
  url: string
  organization: string
  verbose?: boolean
}

export function fieldGetCommand() {
  return new Commander.Command('field:get')
    .description(cliDescriptions.FIELD_GET)
    .requiredOption('-p, --project <project>', cliOptions.PROJECT_KEY)
    .requiredOption('-i, --custom-field-id <customFieldId>', cliOptions.FIELD_ID)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-o, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: GetCustomFieldArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runGetCustomField(args)
    })
}

async function runGetCustomField(args: GetCustomFieldArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })

  const spinner = createSpinner()
  try {
    spinner.start(cliMessages.FETCHING_FIELD)
    const result = await tfClient.getCustomField(args.project, args.customFieldId)
    spinner.stop(cliMessages.FIELD_RETRIEVED)

    p.log.info(`Custom Field Details:`)
    p.log.info(`  ID: ${result.uid}`)
    p.log.info(`  Name: ${result.name}`)
    p.log.info(`  Type: ${result.type}`)
    p.log.info(`  Slug: ${result.slug}`)
    if (result.description) {
      p.log.info(`  Description: ${result.description}`)
    }
    if (result.options && result.options.length > 0) {
      p.log.info(`  Options: ${result.options.join(', ')}`)
    }
    if (result.entityTypes && result.entityTypes.length > 0) {
      p.log.info(`  Entity Types: ${result.entityTypes.join(', ')}`)
    }
  }
  catch (error) {
    spinner.stop(cliMessages.FIELD_RETRIEVE_FAILED)
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
