import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import { XMLParser } from 'fast-xml-parser'
import * as dataUtils from './data'

interface TestData {
  testsuites?: {
    testsuite?: any[]
    [key: string]: any
  }
  testsuite?: any[]
  [key: string]: any
}

interface ParsedData {
  suites: any[]
  executions: any[]
  runs: any[]
}

interface Config {
  integration: string
  ignoreConfig?: {
    runs?: Record<string, any>
    suites?: Record<string, any>
    executions?: Record<string, any>
  }
  [key: string]: any
}

function collapse(inputData: any): any {
  const data: Record<string, any> = {}

  if (typeof inputData === 'string') {
    return inputData
  }
  if (Array.isArray(inputData)) {
    if (inputData.length === 1 && Object.keys(inputData[0]).length === 0) {
      return inputData[0]
    }
    if (inputData.length === 1 && typeof inputData[0] === 'string') {
      return inputData[0]
    }
    if (inputData.length > 1) {
      return inputData.map(element => collapse(element))
    }

    const keys = Object.keys(inputData[0])
    if (keys.some(key => key !== `${Number.parseInt(key)}`)) {
      return collapse(inputData[0])
    }
    return keys.sort((a, b) => Number.parseInt(b) - Number.parseInt(a)).reduce((prev, cur) => prev + cur).trim()
  }

  Object.keys(inputData).forEach((key) => {
    const value = inputData[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (key === '$') {
        Object.assign(data, collapse(value))
      }
      else {
        data[key] = collapse(value)
      }
    }
    else if (Array.isArray(value)) {
      if (key === 'error' && value.length > 0 && typeof value[0] === 'object' && value[0].$) {
        data[key] = {
          message: value[0].$.message,
          $t: (value[0]._ || '').trim(),
        }
      }
      else if (key === 'system-out' && value.length > 0) {
        data[key] = value[0].trim()
      }
      else if (['properties', 'skipped'].includes(key) && value.length === 1) {
        data[key] = typeof value[0] === 'string' ? value[0].trim() : collapse(value[0])
      }
      else {
        data[key] = collapse(value)
      }
    }
    else {
      data[key] = value
    }
  })
  return data
}

function parseJSONData(data: TestData, config: Config): ParsedData {
  const parsedData: ParsedData = { suites: [], executions: [], runs: [] }
  let suiteData = data.testsuites || (data.testsuite || [])
  if (data.testsuites && !data.testsuites.testsuite) {
    suiteData = []
  }
  if (data.testsuites && data.testsuites.testsuite) {
    suiteData = data.testsuites.testsuite
  }
  if (data.testsuites) {
    delete data.testsuites.testsuite
  }

  const testRunId = crypto.randomUUID()
  const newTestRun = dataUtils.mapDataWithIgnores(
    XUnitParser.TEST_RUNS_MAPPING,
    data.testsuites || {},
    (config.ignoreConfig ? config.ignoreConfig.runs : {}),
  )
  newTestRun.generated_source_id = testRunId
  parsedData.runs.push(newTestRun)

  for (const suite of suiteData) {
    let caseData = suite.testcase || []
    if (caseData && !Array.isArray(caseData)) {
      caseData = [caseData]
    }
    delete suite.testcase
    const newTestSuite = dataUtils.mapDataWithIgnores(
      XUnitParser.TEST_SUITES_MAPPING,
      suite,
      (config.ignoreConfig ? config.ignoreConfig.suites : {}),
    )

    if (newTestSuite) {
      const suiteId = (!newTestSuite.source_id
        ? crypto.randomUUID()
        : newTestSuite.source_id)
      if (!newTestSuite.source_id) {
        newTestSuite.generated_source_id = suiteId
      }
      parsedData.suites.push(newTestSuite)

      for (const tcase of caseData) {
        const newTestCase = dataUtils.mapDataWithIgnores(
          XUnitParser.TEST_CASES_MAPPING,
          tcase,
          (config.ignoreConfig ? config.ignoreConfig.executions : {}),
        )
        newTestCase.test_suite_id = suiteId
        newTestCase.test_run_id = testRunId

        if (newTestCase) {
          // A "case" in JUnit parlance is an "execution" for us.
          parsedData.executions.push(newTestCase)
        }
      }
    }
  }

  return parsedData
}

class XUnitParser {
  static TEST_RUNS_MAPPING = {
    name: 'name',
  }

  static TEST_SUITES_MAPPING = {
    name: 'name',
    timestamp: 'created_at',
  }

  static TEST_CASES_MAPPING = {
    name: 'name',
  }

  parseFile(config: Config): ParsedData {
    const parser = new XMLParser()
    return parseJSONData(
      collapse(parser.parse(fs.readFileSync(config.integration))),
      config,
    )
  }
}

export default XUnitParser
