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
  const parsedData: ParsedData = {
    suites: [],
    executions: [],
    runs: [],
  }

  let suiteData = data.testsuite || []
  if (data.testsuites && data.testsuites.testsuite) {
    if (Array.isArray(data.testsuites.testsuite)) {
      suiteData = [...suiteData, ...data.testsuites.testsuite]
    }
    else {
      suiteData = [...suiteData, data.testsuites.testsuite]
    }
  }

  if (data.testsuites) {
    delete data.testsuites.testsuite
  }

  const testRunId = crypto.randomUUID()
  // Directly apply ignoreConfig for runs
  const testRunData = (data.testsuites && typeof data.testsuites === 'object' && 'name' in data.testsuites)
    ? data.testsuites
    : { name: 'Test Run' }

  // Pre-process to handle ignoreConfig before mapping
  if (config.ignoreConfig?.runs) {
    // Remove properties that should be ignored
    Object.keys(config.ignoreConfig.runs).forEach((key) => {
      if (config.ignoreConfig?.runs?.[key] === true) {
        delete testRunData[key]
      }
    })
  }

  const newTestRun = dataUtils.mapDataWithIgnores(
    XUnitParser.TEST_RUNS_MAPPING,
    testRunData,
    {},
  )

  // @ts-expect-error generated_source_id
  newTestRun.generated_source_id = testRunId
  parsedData.runs.push(newTestRun)

  for (const suite of suiteData) {
    let caseData = suite.testcase || []
    if (caseData && !Array.isArray(caseData)) {
      caseData = [caseData]
    }

    const suiteCopy = { ...suite }
    delete suiteCopy.testcase

    // Make sure the suite object has the right properties
    const normalizedSuite = { ...suiteCopy }
    if (normalizedSuite.name === undefined && normalizedSuite.$ && normalizedSuite.$.name) {
      normalizedSuite.name = normalizedSuite.$.name
    }
    if (normalizedSuite.timestamp === undefined && normalizedSuite.$ && normalizedSuite.$.timestamp) {
      normalizedSuite.timestamp = normalizedSuite.$.timestamp
    }

    // Pre-process to handle ignoreConfig for suites
    if (config.ignoreConfig?.suites) {
      // Apply ignore configuration directly
      Object.keys(config.ignoreConfig.suites).forEach((key) => {
        if (config.ignoreConfig?.suites?.[key] === true) {
          // Delete both the original key and the mapped key
          delete normalizedSuite[key]
          const mappedKey = key as keyof typeof XUnitParser.TEST_SUITES_MAPPING
          const targetKey = XUnitParser.TEST_SUITES_MAPPING[mappedKey]
          if (targetKey) {
            delete normalizedSuite[targetKey]
          }
        }
      })
    }

    const newTestSuite = dataUtils.mapDataWithIgnores(
      XUnitParser.TEST_SUITES_MAPPING,
      normalizedSuite,
      {},
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
        // Make sure the test case object has the right properties
        const normalizedCase = { ...tcase }
        if (normalizedCase.name === undefined && normalizedCase.$ && normalizedCase.$.name) {
          normalizedCase.name = normalizedCase.$.name
        }

        // Pre-process to handle ignoreConfig for executions
        if (config.ignoreConfig?.executions) {
          // Apply ignore configuration directly
          Object.keys(config.ignoreConfig.executions).forEach((key) => {
            if (config.ignoreConfig?.executions?.[key] === true) {
              // Delete both the original key and the mapped key
              delete normalizedCase[key]
              const mappedKey = key as keyof typeof XUnitParser.TEST_CASES_MAPPING
              const targetKey = XUnitParser.TEST_CASES_MAPPING[mappedKey]
              if (targetKey) {
                delete normalizedCase[targetKey]
              }
            }
          })
        }

        const newTestCase = dataUtils.mapDataWithIgnores(
          XUnitParser.TEST_CASES_MAPPING,
          normalizedCase,
          {},
        )

        if (newTestCase) {
          newTestCase.test_suite_id = suiteId
          newTestCase.test_run_id = testRunId

          // A "case" in JUnit parlance is an "execution" for us.
          parsedData.executions.push(newTestCase)
        }
      }
    }
  }

  if (config.ignoreConfig) {
    if (config.ignoreConfig.runs && parsedData.runs.length > 0) {
      Object.keys(config.ignoreConfig.runs).forEach((key) => {
        if (config.ignoreConfig?.runs?.[key] === true) {
          // For each run, delete the property if it exists
          parsedData.runs.forEach((run) => {
            delete run[key]
          })
        }
      })
    }

    if (config.ignoreConfig.suites && parsedData.suites.length > 0) {
      Object.keys(config.ignoreConfig.suites).forEach((key) => {
        if (config.ignoreConfig?.suites?.[key] === true) {
          const mappedKey = key as keyof typeof XUnitParser.TEST_SUITES_MAPPING
          const targetKey = XUnitParser.TEST_SUITES_MAPPING[mappedKey] || key
          // For each suite, delete the property if it exists
          parsedData.suites.forEach((suite) => {
            delete suite[targetKey]
          })
        }
      })
    }

    if (config.ignoreConfig.executions && parsedData.executions.length > 0) {
      Object.keys(config.ignoreConfig.executions).forEach((key) => {
        if (config.ignoreConfig?.executions?.[key] === true) {
          const mappedKey = key as keyof typeof XUnitParser.TEST_CASES_MAPPING
          const targetKey = XUnitParser.TEST_CASES_MAPPING[mappedKey] || key
          // For each execution, delete the property if it exists
          parsedData.executions.forEach((execution) => {
            delete execution[targetKey]
          })
        }
      })
    }
  }

  return parsedData
}

class XUnitParser {
  static TEST_RUNS_MAPPING: Record<string, string> = {
    name: 'name',
  }

  static TEST_SUITES_MAPPING: Record<string, string> = {
    name: 'name',
    timestamp: 'created_at',
  }

  static getReverseMappings(mapping: Record<string, string>): Record<string, string> {
    const reverse: Record<string, string> = {}
    Object.entries(mapping).forEach(([key, value]) => {
      reverse[value] = key
    })
    return reverse
  }

  static TEST_CASES_MAPPING: Record<string, string> = {
    'name': 'name',
    'error': 'error',
    'system-out': 'system_out',
    'skipped': 'skipped',
  }

  parseFile(config: Config): ParsedData {
    const content = fs.readFileSync(config.integration)
    return this.parseContent(content.toString(), config)
  }

  parseContent(content: string, config: Config): ParsedData {
    const parser = new XMLParser({
      attributeNamePrefix: '',
      ignoreAttributes: false,
      parseAttributeValue: true,
      textNodeName: '_text',
    })
    return parseJSONData(
      collapse(parser.parse(content)),
      config,
    )
  }
}

export default XUnitParser
