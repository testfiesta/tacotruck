import type { BaseArgs } from '../../../types/type'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaClient } from '../../../clients/testfiesta'
import { initializeLogger, setVerbose } from '../../../utils/logger'

interface CreateProjectArgs extends BaseArgs {
  name: string
  key: string
  token: string
  organization: string
  verbose?: boolean
  customFields?: string
}

export function createProjectCommand() {
  const submitRunCommand = new Commander.Command('projects:create')
    .description('Create a new project in Testfiesta')
    .requiredOption('-n, --name <name>', 'Project name')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-u, --url <url>', 'TestFiesta instance URL (e.g., https://api.testfiesta.com)')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: CreateProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateProject(args)
    })

  return submitRunCommand
}

export async function runCreateProject(args: CreateProjectArgs): Promise<void> {
  const tfClient = new TestFiestaClient({
    apiKey: args.token,
    baseUrl: args.url,
    organizationHandle: args.organization,
  })
  const spinner = p.spinner()
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
