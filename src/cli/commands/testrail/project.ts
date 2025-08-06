import { Buffer } from 'node:buffer'
import { select } from '@inquirer/prompts'
import * as Commander from 'commander'
import { TestRailETL } from '../../../controllers/testrail-etl'
import { getLogger, initializeLogger, setVerbose } from '../../../utils/logger'
import * as p from '@clack/prompts'

interface CreateProjectArgs {
  name: string
  key: string
  email: string
  password: string
  url: string
  verbose?: boolean
  suiteMode?: 1 | 2 | 3
}
const logger = getLogger()

export function createProjectCommand() {
  const createProjectCommand = new Commander.Command('project:create')
    .description('Create a new project in TestRail')
    .requiredOption('-n, --name <n>', 'Project name')
    .requiredOption('-e, --email <email>', 'TestRail email/username')
    .requiredOption('-p, --password <password>', 'TestRail password or api key')
    .requiredOption('-u, --url <url>', 'TestRail instance URL (e.g., https://example.testrail.io)')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-s, --suite-mode <suiteMode>', 'TestRail project structure: 1 (single repository), 2 (single repository with baselines), 3 (multiple test suites)', (value) => {
      const mode = parseInt(value, 10);
      if (![1, 2, 3].includes(mode)) {
        throw new Error('Suite mode must be 1, 2, or 3');
      }
      return mode;
    })
    .action(async (args: CreateProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateProject(args)
    })

  return createProjectCommand
}

export async function runCreateProject(args: CreateProjectArgs): Promise<void> {
  const spinner = p.spinner()
  spinner.start('Creating project in TestRail')
   const handleError = (error: Error, context: string): null => {
    spinner.stop('')
    p.log.error(`${context}: ${error.message}`)
    return null
  }
 try {
  let suiteMode = args.suiteMode;

  if (!suiteMode) {
    suiteMode = await select({
      message: 'Select TestRail project structure:',
      choices: [
        {
          name: '1. Use a single repository for all cases (recommended)',
          value: 1,
          description: 'A single test suite (repository) is easy to manage and flexible enough for most projects with no or few concurrent versions.',
        },
        {
          name: '2. Use a single repository with baseline support',
          value: 2,
          description: 'Use a single test suite (repository) with the additional option to create baselines to manage multiple branches of your test cases at the same time.',
        },
        {
          name: '3. Use multiple test suites to manage cases',
          value: 3,
          description: 'Multiple test suites can be useful to organize your test cases by functional areas and application modules on the test suite level.',
        },
      ],
      default: 1,
    });
  }

  const structureOptions = {
    1: 'Single repository for all cases',
    2: 'Single repository with baseline support',
    3: 'Multiple test suites to manage cases',
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
  spinner.stop('Project created successfully')
  logger.debug('Project created successfully', {
    args,
    suiteMode,
    structureDescription: structureOptions[suiteMode as keyof typeof structureOptions],
  })
 }
 catch (error) {

  handleError(error instanceof Error ? error : new Error(String(error)), 'TestRail API error')

 }
  
}
