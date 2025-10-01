import * as Commander from 'commander'
import { cliDescriptions } from './constants'
import { fieldCreateCommand } from './field/create'
import { fieldDeleteCommand } from './field/delete'
import { fieldGetCommand } from './field/get'
import { fieldListCommand } from './field/list'
import { fieldUpdateCommand } from './field/update'
import { projectCreateCommand } from './project/create'
import { projectDeleteCommand } from './project/delete'
import { projectListCommand } from './project/list'
import { submitRunCommand } from './run'
import { tagCreateCommand } from './tag/create'
import { tagDeleteCommand } from './tag/delete'
import { tagGetCommand } from './tag/get'
import { tagListCommand } from './tag/list'
import { tagUpdateCommand } from './tag/update'

export function createTestfiestaCommand() {
  const tfCommand = new Commander.Command('testfiesta')
    .alias('tf')
    .description(cliDescriptions.TESTFIESTA_MAIN)
    .addCommand(submitRunCommand())
    .addCommand(projectCreateCommand())
    .addCommand(projectDeleteCommand())
    .addCommand(projectListCommand())
    .addCommand(fieldListCommand())
    .addCommand(fieldGetCommand())
    .addCommand(fieldCreateCommand())
    .addCommand(fieldUpdateCommand())
    .addCommand(fieldDeleteCommand())
    .addCommand(tagListCommand())
    .addCommand(tagGetCommand())
    .addCommand(tagCreateCommand())
    .addCommand(tagUpdateCommand())
    .addCommand(tagDeleteCommand())

  return tfCommand
}
