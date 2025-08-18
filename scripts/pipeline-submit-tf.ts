#!/usr/bin/env node
/* eslint-disable no-console */
import type { ExecSyncOptions } from 'node:child_process'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Script to:
 * 1. Create a calculator test file
 * 2. Run the test using vitest with JUnit reporter
 * 3. Submit the test results using the CLI
 */

const TEST_FILE_PATH = path.resolve(__dirname, '../test/calculator.test.ts')
const RESULTS_PATH = path.resolve(__dirname, '../test-results')
const JUNIT_REPORT_PATH = path.resolve(RESULTS_PATH, 'junit.xml')
const BIN_PATH = path.resolve(__dirname, '../bin/index.js')
const CLEANUP_AFTER_RUN = process.env.CLEANUP_AFTER_RUN !== 'false' // Default to true

if (!fs.existsSync(path.dirname(TEST_FILE_PATH))) {
  fs.mkdirSync(path.dirname(TEST_FILE_PATH), { recursive: true })
}

if (!fs.existsSync(RESULTS_PATH)) {
  fs.mkdirSync(RESULTS_PATH, { recursive: true })
}

const calculatorTestContent = `
import { describe, it, expect } from 'vitest';

// Simple calculator functions
function add(a: number, b: number): number {
  return a + b;
}

function subtract(a: number, b: number): number {
  return a - b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

describe('Calculator', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
    expect(add(0, 0)).toBe(0);
  });

  it('should subtract two numbers correctly', () => {
    expect(subtract(5, 3)).toBe(2);
    expect(subtract(1, 1)).toBe(0);
    expect(subtract(0, 5)).toBe(-5);
  });

  it('should multiply two numbers correctly', () => {
    expect(multiply(2, 3)).toBe(6);
    expect(multiply(-1, 3)).toBe(-3);
    expect(multiply(0, 5)).toBe(0);
  });

  it('should divide two numbers correctly', () => {
    expect(divide(6, 3)).toBe(2);
    expect(divide(7, 2)).toBe(3.5);
    expect(divide(0, 5)).toBe(0);
  });

  it('should throw error when dividing by zero', () => {
    expect(() => divide(5, 0)).toThrow('Division by zero');
  });
});
`

/**
 * Clean up test artifacts
 * @returns Promise that resolves when cleanup is complete
 */
async function cleanupArtifacts(): Promise<void> {
  console.log('Cleaning up test artifacts...')

  try {
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH)
      console.log(`Removed test file: ${TEST_FILE_PATH}`)
    }

    if (fs.existsSync(JUNIT_REPORT_PATH)) {
      fs.unlinkSync(JUNIT_REPORT_PATH)
      console.log(`Removed JUnit report: ${JUNIT_REPORT_PATH}`)
    }

    if (fs.existsSync(RESULTS_PATH)) {
      const files = fs.readdirSync(RESULTS_PATH)
      if (files.length === 0) {
        fs.rmdirSync(RESULTS_PATH)
        console.log(`Removed empty directory: ${RESULTS_PATH}`)
      }
    }

    console.log('Cleanup completed successfully.')
  }
  catch (error) {
    console.error('Error during cleanup:', error)
  }
}

async function main() {
  try {
    fs.writeFileSync(TEST_FILE_PATH, calculatorTestContent)

    p.log.info('Running tests with vitest')
    try {
      const testCommand = `npx vitest run "${TEST_FILE_PATH}" --reporter=junit --outputFile="${JUNIT_REPORT_PATH}"`
      console.log(`Executing: ${testCommand}`)
      execSync(testCommand, {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..'),
      })
      p.log.success('Tests completed successfully')
    }
    catch (error) {
      p.log.error(`Tests completed with some failures (this is okay for this demo) ${error}`)
      await setTimeout(1000)
    }

    if (!fs.existsSync(JUNIT_REPORT_PATH)) {
      throw new Error(`JUnit report was not generated at path: ${JUNIT_REPORT_PATH}`)
    }

    console.log(`JUnit report was generated at: ${JUNIT_REPORT_PATH}`)
    console.log(`Report file size: ${fs.statSync(JUNIT_REPORT_PATH).size} bytes`)

    const token = process.env.TESTFIESTA_TOKEN || 'random_token' || await p.text({
      message: 'Enter your TestFiesta API token:',
      validate: value => value.length === 0 ? 'Token is required' : undefined,
    })

    const orgHandle = process.env.TESTFIESTA_ORG || 'random_org_handle' || await p.text({
      message: 'Enter your organization handle:',
      validate: value => value.length === 0 ? 'Organization handle is required' : undefined,
    })

    const projectKey = process.env.TESTFIESTA_PROJECT || 'random_project_key' || await p.text({
      message: 'Enter your project key:',
      validate: value => value.length === 0 ? 'Organization project is required' : undefined,
    })

    if (p.isCancel(token) || p.isCancel(orgHandle) || p.isCancel(projectKey)) {
      p.log.warning('Submission cancelled')
      process.exit(1)
    }

    try {
      if (!fs.existsSync(BIN_PATH)) {
        p.log.warn(`CLI binary not found at path: ${BIN_PATH}`)
        p.log.info('Falling back to NPX for CLI execution')

        const npxCommand = `npx tacotruck testfiesta run:submit -d "${JUNIT_REPORT_PATH}" -t "${token}" -h "${orgHandle}" -p "${projectKey}"`
        console.log(`Executing: ${npxCommand}`)

        execSync(npxCommand, {
          stdio: 'inherit',
          cwd: path.resolve(__dirname, '..'),
          env: { ...process.env, NODE_ENV: 'production' },
        })

        return
      }

      try {
        fs.chmodSync(BIN_PATH, '755')
      }
      catch (err) {
        console.warn(`Warning: Could not make binary executable: ${err}`)
      }

      const submitCommand = `"${BIN_PATH}" testfiesta run:submit -d "${JUNIT_REPORT_PATH}" -t "${token}" -h "${orgHandle}" -k "${projectKey}"`
      console.log(`Executing: ${submitCommand}`)

      const execOptions: ExecSyncOptions = {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'production' },
      }

      execSync(submitCommand, execOptions)
    }
    catch (error) {
      throw new Error(`Failed to submit test results: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (CLEANUP_AFTER_RUN) {
      await cleanupArtifacts()
    }
    else {
      console.log('Test artifacts have been preserved:')
      console.log(`- Test file: ${TEST_FILE_PATH}`)
      console.log(`- JUnit report: ${JUNIT_REPORT_PATH}`)
    }
  }
  catch (error) {
    p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`)

    if (CLEANUP_AFTER_RUN) {
      await cleanupArtifacts()
    }

    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  console.log('\nProcess interrupted. Cleaning up before exit...')
  await cleanupArtifacts()
  process.exit(0)
})

main()
