import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaETL } from '../../../testfiesta-etl'
import { initializeLogger, setVerbose } from '../../../utils/logger'

interface CreateProjectArgs {
  name: string
  key: string
  token: string
  priority: number
  status: number
  handle: string
  verbose?: boolean
  description?: string
  customFields?: string
}

export function createProjectCommand() {
  const submitRunCommand = new Commander.Command('project:create')
    .description('Create a new project in Testfiesta')
    .requiredOption('-n, --name <n>', 'Project name')
    .requiredOption('-k, --key <key>', 'Project key')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: CreateProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateProject(args)
    })

  return submitRunCommand
}

export async function runCreateProject(args: CreateProjectArgs & { verbose?: boolean }): Promise<void> {
  const spinner = p.spinner()
  try {
    spinner.start('Creating project in TestFiesta')
    const testFiestaETL = await TestFiestaETL.fromConfig({
      credentials: {
        token: args.token,
      },
      etlOptions: {
        baseUrl: 'https://staging.api.testfiesta.com',
        enablePerformanceMonitoring: false,
        strictMode: false,
        retryAttempts: 3,
        timeout: 30000,
      },
    })
    const customFields = args.customFields ? JSON.parse(args.customFields) : {}
    await testFiestaETL.submitProjects({
      name: args.name,
      key: args.key,
      customFields,
    }, {
      handle: args.handle,
    })
    spinner.stop('Project created successfully')
  }
  catch (error) {
    spinner.stop('Project creation failed')
    p.log.error(`${error instanceof Error ? error.message : String(error)}`)
  }
}
