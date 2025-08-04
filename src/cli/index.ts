import { Command } from 'commander'
import * as pJson from '../../package.json'
import * as migrate from './commands/migrate'
import * as testfiesta from './commands/testfiesta'
import * as testrail from './commands/testrail'
import { initPackageRoot, renderTitle } from './utils'

initPackageRoot()

const program = new Command()

renderTitle()

program
  .name('tacotruck')
  .version(pJson.version)
program.addCommand(migrate.createMigrateCommand())
program.addCommand(testfiesta.createTestfiestaCommand())
program.addCommand(testrail.createTestrailCommand())

program.parse()
