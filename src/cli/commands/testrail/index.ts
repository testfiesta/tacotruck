import * as Commander from 'commander'
import { deleteProjectCommand } from './delete-project'
import { createProjectCommand } from './project'
import { submitRunCommand } from './run'

export function createTestrailCommand() {
  const trCommand = new Commander.Command('testrail')
    .description('TestRail platform specific commands')
    .addCommand(submitRunCommand())
    .addCommand(createProjectCommand())
    .addCommand(deleteProjectCommand())

  return trCommand
}
