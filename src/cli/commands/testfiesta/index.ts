import * as Commander from 'commander'
import { createProjectCommand } from './create-project'
import { deleteProjectCommand } from './delete-project'
import { getProjectsCommand } from './get-projects'
import { submitRunCommand } from './run'

export function createTestfiestaCommand() {
  const tfCommand = new Commander.Command('testfiesta')
    .alias('tf')
    .description('TestFiesta platform specific commands')
    .addCommand(submitRunCommand())
    .addCommand(createProjectCommand())
    .addCommand(deleteProjectCommand())
    .addCommand(getProjectsCommand())

  return tfCommand
}
