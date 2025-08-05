import * as Commander from 'commander'
import { getLogger, initializeLogger, setVerbose } from '../../../utils/logger'
import { TestRailETL } from '../../../controllers/testrail-etl'
import { select } from '@inquirer/prompts'

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

export async function runCreateProject(args: CreateProjectArgs): Promise<void> {
  const logger = getLogger()
  
  // Interactive prompt for TestRail structure selection
  const suiteMode = await select({
    message: 'Select TestRail project structure:',
    choices: [
      {
        name: '1. Use a single repository for all cases (recommended)',
        value: 1,
        description: 'A single test suite (repository) is easy to manage and flexible enough for most projects with no or few concurrent versions.'
      },
      {
        name: '2. Use a single repository with baseline support',
        value: 2,
        description: 'Use a single test suite (repository) with the additional option to create baselines to manage multiple branches of your test cases at the same time.'
      },
      {
        name: '3. Use multiple test suites to manage cases',
        value: 3,
        description: 'Multiple test suites can be useful to organize your test cases by functional areas and application modules on the test suite level.'
      }
    ],
    default: 1
  })

  const structureOptions = {
    1: 'Single repository for all cases',
    2: 'Single repository with baseline support', 
    3: 'Multiple test suites to manage cases'
  }

  logger.info(`Using TestRail structure: ${structureOptions[suiteMode as keyof typeof structureOptions]}`)

  const testRailETL = await TestRailETL.fromConfig({
    credentials: {
      base64Credentials: Buffer.from(`${args.email}:${args.password}`).toString('base64'),
      base_url: args.url,
    },
    etlOptions: {
      baseUrl: args.url,
      enablePerformanceMonitoring: false,
      strictMode: false,
      retryAttempts: 3,
      timeout: 30000,
    },
  })

  await testRailETL.submitProjects({
    name: args.name,
    suite_mode: suiteMode,
  })

  logger.debug('Creating project in TestRail', { 
    args: args,
    suiteMode: suiteMode,
    structureDescription: structureOptions[suiteMode as keyof typeof structureOptions]
  })
}