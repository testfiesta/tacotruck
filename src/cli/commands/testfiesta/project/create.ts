import type { BaseArgs } from '../../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { cliDescriptions, cliOptions } from '../constants'

interface CreateProjectArgs extends BaseArgs {
  name: string
  key: string
  token: string
  organization: string
  verbose?: boolean
  customFields?: string
}

export function projectCreateCommand() {
  return new Commander.Command('project:create')
    .description(cliDescriptions.PROJECT_CREATE)
    .requiredOption('-n, --name <name>', cliOptions.PROJECT_NAME)
    .requiredOption('-t, --token <token>', cliOptions.TOKEN)
    .requiredOption('-u, --url <url>', cliOptions.URL)
    .requiredOption('-h, --organization <organization>', cliOptions.ORGANIZATION)
    .option('-v, --verbose', cliOptions.VERBOSE)
    .action(async (args: CreateProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateProject(args)
    })
}

export async function runCreateProject(args: CreateProjectArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })
  const spinner = createSpinner()
  try {
    spinner.start('Creating project in TestFiesta')
    const customFields = args.customFields ? JSON.parse(args.customFields) : {}
    await tfClient.createProject({
      name: args.name,
      key: args.key,
      customFields,
    })
    spinner.stop('Project created successfully')
  }
  catch (error) {
    spinner.stop('Project creation failed')
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
