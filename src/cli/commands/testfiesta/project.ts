import * as Commander from 'commander'

interface CreateProjectArgs {
  name: string
  key: string
  organization: string
}

export function createProjectCommand() {
  const submitRunCommand = new Commander.Command('project:create')
    .description('Create a new project in Testfiesta')
    .requiredOption('-n, --name <name>', 'Project name')
    .requiredOption('-k, --key <key>', 'Project key')
    .requiredOption('-t, --token <token>', 'Testfiesta API token')
    .requiredOption('-h, --organization <organization>', 'Organization handle')
    .action(async (args: CreateProjectArgs) => {
      await runCreateProject(args)
    })

  return submitRunCommand
}

export async function runCreateProject(_args: CreateProjectArgs): Promise<void> {
}
