import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import * as pJson from '../../package.json'
import asyncStorage from '../utils/asyncStorage'
import * as migrate from './commands/migrate'
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
  .description(pJson.description)
  .option('-i, --incremental', 'Only pull incremental data based on the last ID uploaded to target')
  .option('-I, --ignore <path>', 'Path to a config file specifying source records to ignore.')
  .option('-o, --overrides <json>', 'JSON data to include in target data')
  .option('-d, --data-types <types>', 'Data type keys to use from source config')
  .option('--offset <value>', 'Paging offset value.')
  .option('--limit <value>', 'Paging limit value.')
  .option('--count <value>', 'Maximum record count to return.')
  .option('--no-git', 'Do not include git information')
  .option('-v, --verbose', 'Enable verbose output')

program.addCommand(migrate.createMigrateCommand())

program.parse()
