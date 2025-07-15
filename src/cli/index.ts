import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import * as pJson from '../../package.json'
import { renderTitle } from './utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '../..')

const program = new Command()

const availableConfigs = fs.readdirSync(`${packageRoot}/configs`)
  .filter(file => !(/(^|\/)\.[^/.]/).test(file))
  .map((file) => {
    return file.split('.')[0]
  })
  .join(', ')

renderTitle()

program
  .name('tacotruck')
  .version(pJson.version)
  .description(pJson.description)
  .option('-c, --credentials <path>', 'Path to credentials file for API connections. (See README.)')
  .option('-i, --incremental', 'Only pull incremental data based on the last ID uploaded to target')
  .option('-I, --ignore <path>', 'Path to a config file specifying source records to ignore.')
  .option('-o, --overrides <json>', 'JSON data to include in target data')
  .requiredOption('-s, --source <source>', `For type api - One of: ${availableConfigs} or the path to a custom JSON api config.\nFor type junit - the path to a JUnit-style XML file.`)
  .requiredOption('-t, --target <target>', `One of: ${availableConfigs}`)
  .option('-d, --data-types <types>', 'Data type keys to use from source config')
  .option('--offset <value>', 'Paging offset value.')
  .option('--limit <value>', 'Paging limit value.')
  .option('--count <value>', 'Maximum record count to return.')
  .option('--no-git', 'Do not include git information')
  .option('-v, --verbose', 'Enable verbose output')

program.parse()
