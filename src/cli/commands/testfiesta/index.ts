import * as Commander from 'commander'
import { deleteProjectCommand } from './delete-project'
import { createProjectCommand } from './project'
import { submitRunCommand } from './run'

export function createTestfiestaCommand() {
  const tfCommand = new Commander.Command('testfiesta')
    .description('TestFiesta platform specific commands')
    .addCommand(submitRunCommand())
    .addCommand(createProjectCommand())
    .addCommand(deleteProjectCommand())

  return tfCommand
}
