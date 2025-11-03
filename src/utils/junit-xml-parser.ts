import type { JunitParserResult, JunitXmlParserOptions, RootSuite, StatusMap, TestCase, TestSuite, XmlRoot, XmlToJsMap } from '../types'
import type { TestCaseIdentifier, TestSuiteIdentifier } from './external-id-generator'
import type { ExecutionData } from './xml-transform'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import { externalIdGenerator } from './external-id-generator'

export class JunitXmlParser {
  private xml: string
  private parsedXml: XmlRoot | null
  private xmlToJsMap: XmlToJsMap = {
    suites: 'root',
    suite: 'section',
    testcase: 'testcase',
  }

  private statusMap: StatusMap = {
    passed: 'passed',
    failed: 'failed',
    blocked: 'blocked',
    skipped: 'skipped',
    error: 'error',
  }

  private testSuites: TestSuite[]
  private testCases: TestCase[]
  private testExecutions: ExecutionData[]
  private rootSuite: RootSuite | null
  private runId: string

  constructor(options?: JunitXmlParserOptions) {
    this.xml = ''
    this.testSuites = []
    this.testCases = []
    this.testExecutions = []
    this.parsedXml = null
    this.rootSuite = null
    this.xmlToJsMap = options?.xmlToJsMap || this.xmlToJsMap
    this.statusMap = options?.statusMap || this.statusMap
    this.runId = options?.runId || crypto.randomUUID()
  }

  fromXml(xml: string): JunitXmlParser {
    this.xml = xml
    return this
  }

  fromFile(filePath: string): JunitXmlParser {
    if (!filePath) {
      throw new Error('File path cannot be empty')
    }

    const resolvedPath = path.resolve(process.cwd(), filePath)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Results file not found: ${resolvedPath}`)
    }

    try {
      const xml = fs.readFileSync(filePath, 'utf8')
      this.xml = xml
      return this
    }
    catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  private parse(xml?: string): JunitXmlParser {
    this.xml = xml || this.xml

    if (!this.xml) {
      throw new Error('Cannot parse empty XML')
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      textNodeName: '_text',
    })

    this.parsedXml = parser.parse(this.xml)
    return this
  }

  private applyRootSuite(): JunitXmlParser {
    if (this.parsedXml?.testsuites) {
      this.rootSuite = {
        name: 'root',
        tests: 0,
        errors: 0,
        failures: 0,
        skipped: 0,
        time: 0,
      }
      this.visitTestSuite(this.parsedXml.testsuites)
    }
    else if (this.parsedXml?.testsuite) {
      this.rootSuite = {
        name: 'root',
        tests: 0,
        errors: 0,
        failures: 0,
        skipped: 0,
        time: 0,
      }
      this.visitTestSuite(this.parsedXml)
    }
    else {
      this.rootSuite = {}
    }
    return this
  }

  private visitTestSuite(suiteData: any): void {
    const testsuites = suiteData.testsuite
      ? (Array.isArray(suiteData.testsuite) ? suiteData.testsuite : [suiteData.testsuite])
      : []

    for (const suite of testsuites) {
      const suiteIdentifier: TestSuiteIdentifier = {
        name: suite.name || '',
        file: suite?.file || '',
      }

      const testSuite: TestSuite = {
        name: suite.name || '',
        tests: suite.tests || 0,
        errors: suite.errors || 0,
        failures: suite.failures || 0,
        skipped: suite.skipped || 0,
        time: suite.time || 0,
        timestamp: suite.timestamp,
        file: suite?.file,
        externalId: externalIdGenerator.generateTestSuiteId(suiteIdentifier),
        source: 'junit-xml',
        testcases: [],
      }

      this.testSuites.push(testSuite)

      if (this.rootSuite) {
        this.rootSuite.tests = (this.rootSuite.tests || 0) + (testSuite.tests || 0)
        this.rootSuite.errors = (this.rootSuite.errors || 0) + (testSuite.errors || 0)
        this.rootSuite.failures = (this.rootSuite.failures || 0) + (testSuite.failures || 0)
        this.rootSuite.skipped = (this.rootSuite.skipped || 0) + (testSuite.skipped || 0)
        this.rootSuite.time = (this.rootSuite.time || 0) + (testSuite.time || 0)
      }

      if (suite.testcase) {
        this.visitTestCase(suite.testcase, testSuite)
      }
    }
  }

  private visitTestCase(caseData: any, parent: TestSuite): void {
    const testcases = Array.isArray(caseData) ? caseData : [caseData]

    if (!parent.testcases) {
      parent.testcases = []
    }

    for (const tc of testcases) {
      const testCaseIdentifier: TestCaseIdentifier = {
        name: tc.name || '',
        classname: tc.classname || '',
        suiteName: parent?.name || '',
        file: parent.file,
      }

      const externalId = externalIdGenerator.generateTestCaseId(testCaseIdentifier)

      const testCase: TestCase = {
        name: tc.name || '',
        classname: tc.classname || '',
        time: tc.time || 0,
        source: 'junit-xml',
        externalId,
        folderExternalId: parent?.externalId || '',
      }

      if (tc['system-out'] !== undefined) {
        testCase['system-out'] = typeof tc['system-out'] === 'string'
          ? tc['system-out']
          : tc['system-out']?._text || ''
      }

      if (tc['system-err'] !== undefined) {
        testCase['system-err'] = typeof tc['system-err'] === 'string'
          ? tc['system-err']
          : tc['system-err']?._text || ''
      }
      const execution: ExecutionData = {
        source: 'junit-xml',
        externalId,
        caseRef: externalId,
        runRef: this.runId,
        time: tc.time || 0,
      }

      let status = this.statusMap.passed

      if (tc.failure) {
        status = this.statusMap.failed
        testCase.failure = {
          message: tc.failure.message,
          type: tc.failure.type,
          _text: tc.failure._text,
        }
      }
      else if (tc.error) {
        status = this.statusMap.error
        testCase.error = {
          message: tc.error.message,
          type: tc.error.type,
          _text: tc.error._text,
        }
      }
      else if (tc.blocked) {
        status = this.statusMap.blocked
        testCase.error = {
          message: tc.error?.message,
          type: tc.error?.type,
          _text: tc.error?._text,
        }
      }
      else if (tc.skipped) {
        status = this.statusMap.skipped
        testCase.skipped = {
          message: tc.skipped.message,
        }
      }

      execution.status = status

      this.testCases.push(testCase)
      this.testExecutions.push(execution)
    }
  }

  withSuites(): this {
    this.parse(this.xml)
    this.applyRootSuite()
    return this
  }

  private removeStatusFromTestCases(testCases: TestCase[]): TestCase[] {
    return testCases.map((testCase) => {
      const { status, ...testCaseWithoutStatus } = testCase as any
      return testCaseWithoutStatus
    })
  }

  build(): JunitParserResult {
    if (!this.parsedXml) {
      this.parse(this.xml)
      this.applyRootSuite()
    }

    const cleanedTestCases = this.removeStatusFromTestCases(this.testCases)

    const result: JunitParserResult = {
      [this.xmlToJsMap.suites]: this.rootSuite,
      [this.xmlToJsMap.suite]: this.testSuites,
      [this.xmlToJsMap.testcase]: cleanedTestCases,
      executions: this.testExecutions,
      runId: this.runId,
    }

    return result
  }
}
