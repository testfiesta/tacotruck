import * as Commander from 'commander'
import { getLogger, initializeLogger, setVerbose } from '../../../utils/logger'
import { TestRailETL } from '../../../controllers/testrail-etl'

interface CreateProjectArgs {
  name: string
  key: string
  email: string
  password: string
  url: string
  verbose?: boolean
}

export function createProjectCommand() {
  const createProjectCommand = new Commander.Command('project:create')
    .description('Create a new project in TestRail')
    .requiredOption('-n, --name <n>', 'Project name')
    .requiredOption('-e, --email <email>', 'TestRail email/username')
    .requiredOption('-p, --password <password>', 'TestRail password or api key')
    .requiredOption('-u, --url <url>', 'TestRail instance URL (e.g., https://example.testrail.io)')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (args: CreateProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateProject(args)
    })

  return createProjectCommand
}

export async function runCreateProject(_args: CreateProjectArgs): Promise<void> {
    const testRailETL = await TestRailETL.fromConfig({
      credentials: {
        base64Credentials: Buffer.from(`${_args.email}:${_args.password}`).toString('base64'),
        base_url: _args.url,
      },
      etlOptions: {
        baseUrl: _args.url,
        enablePerformanceMonitoring: false,
        strictMode: false,
        retryAttempts: 3,
        timeout: 30000,
      },
    })
 await testRailETL.submitProjects({
    name: _args.name,
  })

  const logger = getLogger()
  logger.debug('Creating project in TestRail', { args: _args })
}