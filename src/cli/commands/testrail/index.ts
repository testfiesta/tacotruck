import * as Commander from 'commander'
import { projectCreateCommand, projectDeleteCommand, projectListCommand } from './project'
import { submitRunCommand } from './run'

export function createTestrailCommand() {
  const trCommand = new Commander.Command('testrail')
    .alias('tr')
    .description('TestRail platform specific commands')
    .addCommand(submitRunCommand())
    .addCommand(projectCreateCommand())
    .addCommand(projectDeleteCommand())
    .addCommand(projectListCommand())

  return trCommand
}
