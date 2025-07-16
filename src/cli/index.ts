import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import * as pJson from '../../package.json'
import asyncStorage from '../utils/asyncStorage'
import * as migrate from './commands/migrate'
import * as testfiesta from './commands/testfiesta'
import * as testrails from './commands/testrails'
import { renderTitle } from './utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '../..')

asyncStorage.setItem('packageRoot', packageRoot)

const program = new Command()

renderTitle()

program
  .name('tacotruck')
  .version(pJson.version)
program.addCommand(migrate.createMigrateCommand())
program.addCommand(testfiesta.createTestfiestaCommand())
program.addCommand(testrails.createTestrailsCommand())

program.parse()
