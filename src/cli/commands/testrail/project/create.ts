import type { BaseArgs } from '../../../../types'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestRailClient } from '../../../../clients/testrail'
import { getLogger, initializeLogger, setVerbose } from '../../../../utils/logger'
import { createSpinner } from '../../../../utils/spinner'
import { shouldShowAnimations } from '../../../../utils/tty'

interface CreateProjectArgs extends BaseArgs {
  name: string
  key: string
  token: string
  url: string
  verbose?: boolean
  suiteMode?: 1 | 2 | 3
}
const logger = getLogger()

export function projectCreateCommand() {
  const createProjectCommand = new Commander.Command('project:create')
    .description('Create a new project in TestRail')
    .requiredOption('-n, --name <name>', 'Project name')
    .requiredOption('-t, --token <token>', 'TestRail API token. Use username:password format')
    .requiredOption('-u, --url <url>', 'TestRail instance URL (e.g., https://example.testrail.io)')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-s, --suite-mode <suiteMode>', 'TestRail project structure: 1 (single repository), 2 (single repository with baselines), 3 (multiple test suites)', (value) => {
      const mode = Number.parseInt(value, 10)
      if (![1, 2, 3].includes(mode)) {
        throw new Error('Suite mode must be 1, 2, or 3')
      }
      return mode
    })
    .action(async (args: CreateProjectArgs) => {
      initializeLogger({ verbose: !!args.verbose })
      setVerbose(!!args.verbose)
      await runCreateProject(args)
    })

  return createProjectCommand
}

export async function runCreateProject(args: CreateProjectArgs): Promise<void> {
  const spinner = createSpinner()
  spinner.start('Creating project in TestRail')
  const handleError = (error: Error, context: string): null => {
    spinner.stop('')
    p.log.error(`${context}: ${error.message}`)
    return null
  }
  try {
    let suiteMode = args.suiteMode

    if (!suiteMode) {
      if (shouldShowAnimations()) {
        const selectedMode = await p.select({
          message: 'Select TestRail project structure:',
          options: [
            {
              label: '1. Use a single repository for all cases (recommended)',
              value: 1,
              hint: 'A single test suite (repository) is easy to manage and flexible enough for most projects with no or few concurrent versions.',
            },
            {
              label: '2. Use a single repository with baseline support',
              value: 2,
              hint: 'Use a single test suite (repository) with the additional option to create baselines to manage multiple branches of your test cases at the same time.',
            },
            {
              label: '3. Use multiple test suites to manage cases',
              value: 3,
              hint: 'Multiple test suites can be useful to organize your test cases by functional areas and application modules on the test suite level.',
            },
          ],
          initialValue: 1,
        })

        if (p.isCancel(selectedMode)) {
          p.log.info('Project creation cancelled')
          return
        }

        suiteMode = selectedMode as 1 | 2 | 3
      }
      else {
        suiteMode = 1
        console.warn('Using default TestRail project structure: Single repository for all cases (recommended)')
        console.warn('To specify a different structure, use the --suite-mode option (1, 2, or 3)')
      }
    }

    const structureOptions = {
      1: 'Single repository for all cases',
      2: 'Single repository with baseline support',
      3: 'Multiple test suites to manage cases',
    }

    if (!suiteMode) {
      throw new Error('Suite mode is required but not provided')
    }

    logger.info(`Using TestRail structure: ${structureOptions[suiteMode]}`)

    const testRailClient = new TestRailClient({
      baseUrl: args.url,
      apiKey: args.token,
    })

    await testRailClient.createProject({
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
