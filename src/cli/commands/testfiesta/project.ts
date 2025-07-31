import * as Commander from 'commander'
import { getLogger, initializeLogger, setVerbose } from '../../../utils/logger'

interface CreateProjectArgs {
  name: string
  key: string
  organization: string
  verbose?: boolean
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

export async function runCreateProject(_args: CreateProjectArgs & { verbose?: boolean }): Promise<void> {
  const logger = getLogger()
  logger.debug('Creating project in TestFiesta', { args: _args })
}
