import type { Result } from '../../utils/result'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import * as Commander from 'commander'
import { TestFiestaETL } from '../../controllers/testfiesta-etl'
import { err, ok } from '../../utils/result'

interface SubmitRunArgs {
  data: string
  credentials: string
}

interface RunData {
  [key: string]: any
}

/**
 * Load config file from the specified path
 * @param configPath Path to the config file
 * @returns Result with config file content or error
 */
function loadConfigFile(configPath: string): Result<string, Error> {
  try {
    const resolvedPath = path.resolve(process.cwd(), configPath)
    if (!fs.existsSync(resolvedPath)) {
      return err(new Error(`Config file not found: ${resolvedPath}`))
    }
    return ok(resolvedPath)
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Load credentials from the specified path
 * @param credentialsPath Path to the credentials file
 * @returns Result with parsed credentials or error
 */
function loadCredentials(credentialsPath: string): Result<any, Error> {
  try {
    if (!fs.existsSync(credentialsPath)) {
      return err(new Error(`Credentials file not found: ${credentialsPath}`))
    }
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    return ok(credentials)
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(`Failed to parse credentials: ${String(error)}`))
  }
}

/**
 * Load and parse run data from the specified path
 * @param dataPath Path to the data file
 * @returns Result with parsed run data or error
 */
function loadRunData(dataPath: string): Result<RunData, Error> {
  try {
    const resolvedPath = path.resolve(process.cwd(), dataPath)
    if (!fs.existsSync(resolvedPath)) {
      return err(new Error(`Data file not found: ${resolvedPath}`))
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf8')
    const ext = path.extname(resolvedPath).toLowerCase()

    if (ext === '.json') {
      return ok(JSON.parse(fileContent))
    }
    else if (ext === '.xml') {
      return ok({ resultsFilePath: resolvedPath })
    }
    else {
      return err(new Error(`Unsupported file format: ${ext}. Only JSON and XML files are supported.`))
    }
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(`Failed to load run data: ${String(error)}`))
  }
}

function submitRunCommand() {
  const submitRunCommand = new Commander.Command('run:submit')
    .description('submit test run to TestFiesta')
    .requiredOption('-d, --data <path>', 'path to test run data JSON file')
    .requiredOption('-c, --credentials <path>', 'path to credentials JSON file')
    .action(async (args: SubmitRunArgs) => {
      await run(args).catch((e) => {
        p.log.error('Failed to submit test run')
        p.log.error(`✘ ${String(e)}`)
        process.exit(1)
      })
    })

  return submitRunCommand
}

export function createTestfiestaCommand() {
  const tfCommand = new Commander.Command('testfiesta')
    .description('TestFiesta platform specific commands')
    .addCommand(submitRunCommand())

  return tfCommand
}

export async function run(args: SubmitRunArgs): Promise<void> {
  const spinner = p.spinner()
  spinner.start('Submitting test run to TestFiesta')

  const handleError = (error: Error, context: string): null => {
    spinner.stop()
    p.log.error(`${context}: ${error.message}`)
    return null
  }

  try {
    const configPath = loadConfigFile('./configs/testfiesta.json').match({
      ok: path => path,
      err: error => handleError(error, 'Configuration error'),
    })

    if (configPath === null)
      return

    const credentials = loadCredentials(args.credentials).match({
      ok: creds => creds,
      err: error => handleError(error, 'Credentials error'),
    })

    if (credentials === null)
      return

    const testFiestaETL = await TestFiestaETL.fromConfigFile(configPath, credentials)

    const runData = loadRunData(args.data).match({
      ok: data => data,
      err: error => handleError(error, 'Data error'),
    })

    if (runData === null)
      return

    const result = await testFiestaETL.submitTestRun(runData)

    spinner.stop()
    p.log.success('Test run submitted successfully')
    p.log.info(`Result: ${JSON.stringify(result, null, 2)}`)
  }
  catch (error) {
    spinner.stop()
    p.log.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
  }
}
