import * as Commander from 'commander'
import { cliDescriptions } from './constants'
import { fieldCreateCommand } from './field/create'
import { fieldDeleteCommand } from './field/delete'
import { fieldGetCommand } from './field/get'
import { fieldListCommand } from './field/list'
import { fieldUpdateCommand } from './field/update'
import { milestoneCreateCommand } from './milestone/create'
import { milestoneDeleteCommand } from './milestone/delete'
import { milestoneGetCommand } from './milestone/get'
import { milestoneListCommand } from './milestone/list'
import { milestoneUpdateCommand } from './milestone/update'
import { projectCreateCommand } from './project/create'
import { projectDeleteCommand } from './project/delete'
import { projectListCommand } from './project/list'
import { submitRunCommand } from './run'
import { tagCreateCommand } from './tag/create'
import { tagDeleteCommand } from './tag/delete'
import { tagGetCommand } from './tag/get'
import { tagListCommand } from './tag/list'
import { tagUpdateCommand } from './tag/update'
import { templateCreateCommand } from './template/create'
import { templateDeleteCommand } from './template/delete'
import { templateGetCommand } from './template/get'
import { templateListCommand } from './template/list'
import { templateUpdateCommand } from './template/update'

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
    .addCommand(templateListCommand())
    .addCommand(templateGetCommand())
    .addCommand(templateCreateCommand())
    .addCommand(templateUpdateCommand())
    .addCommand(templateDeleteCommand())
    .addCommand(milestoneListCommand())
    .addCommand(milestoneGetCommand())
    .addCommand(milestoneCreateCommand())
    .addCommand(milestoneUpdateCommand())
    .addCommand(milestoneDeleteCommand())

  return tfCommand
}
