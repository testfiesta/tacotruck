import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

interface XmlToJsMap {
  suites: string
  suite: string
  testcase: string
}

interface StatusMap {
  passed: any
  failed: any
  error: any
  skipped: any
}

export interface JunitParserResult {
  [key: string]: RootSuite | null | TestSuite[] | TestCase[] | any
}

interface JunitXmlParserOptions {
  xmlToJsMap?: XmlToJsMap
  statusMap?: StatusMap
}

export interface RootSuite {
  name?: string
  tests?: number
  errors?: number
  failures?: number
  skipped?: number
  assertions?: number
  time?: number
  timestamp?: string
}

export interface TestCase {
  name: string
  classname: string
  time: number
  status: any
  failure?: {
    message?: string
    type?: string
    _text?: string
  }
  error?: {
    message?: string
    type?: string
    _text?: string
  }
  skipped?: {
    message?: string
  }
}

export interface TestSuite extends RootSuite {
  file?: string
  testcases?: TestCase[]
}

interface XmlRoot {
  testsuites?: {
    testsuite?: any
  }
  testsuite?: any
}

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
    error: 'error',
    skipped: 'skipped',
  }

  private testSuites: TestSuite[]
  private testCases: TestCase[]
  private rootSuite: RootSuite | null

  constructor(xml?: string, options?: JunitXmlParserOptions) {
    this.xml = xml || ''
    this.testSuites = []
    this.testCases = []
    this.parsedXml = null
    this.rootSuite = null
    this.xmlToJsMap = options?.xmlToJsMap || this.xmlToJsMap
    this.statusMap = options?.statusMap || this.statusMap
  }

  fromXml(xml: string): JunitXmlParser {
    return new JunitXmlParser(xml)
  }

  fromFile(filePath: string): JunitXmlParser {
    if (!filePath) {
      throw new Error('File path cannot be empty')
    }

    try {
      const xml = readFileSync(filePath, 'utf8')
      return new JunitXmlParser(xml, {
        xmlToJsMap: this.xmlToJsMap,
        statusMap: this.statusMap,
      })
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
      const testSuite: TestSuite = {
        name: suite.name || '',
        tests: suite.tests || 0,
        errors: suite.errors || 0,
        failures: suite.failures || 0,
        skipped: suite.skipped || 0,
        time: suite.time || 0,
        timestamp: suite.timestamp,
        file: suite.file,
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
      const testCase: TestCase = {
        name: tc.name || '',
        classname: tc.classname || '',
        time: tc.time || 0,
        status: this.statusMap.passed,
      }

      if (tc.failure) {
        testCase.status = this.statusMap.failed
        testCase.failure = {
          message: tc.failure.message,
          type: tc.failure.type,
          _text: tc.failure._text,
        }
      }
      else if (tc.error) {
        testCase.status = this.statusMap.error
        testCase.error = {
          message: tc.error.message,
          type: tc.error.type,
          _text: tc.error._text,
        }
      }
      else if (tc.skipped) {
        testCase.status = this.statusMap.skipped
        testCase.skipped = {
          message: tc.skipped.message,
        }
      }
      else {
        testCase.status = this.statusMap.passed
      }

      this.testCases.push(testCase)
      parent.testcases.push(testCase)
    }
  }

  withSuites(): this {
    this.parse(this.xml)
    this.applyRootSuite()
    return this
  }

  build(): JunitParserResult {
    if (!this.parsedXml) {
      this.parse(this.xml)
      this.applyRootSuite()
    }

    const result: JunitParserResult = {
      root: this.rootSuite,
      section: this.testSuites,
      testcase: this.testCases,
    }

    result[this.xmlToJsMap.suites] = this.rootSuite
    result[this.xmlToJsMap.suite] = this.testSuites
    result[this.xmlToJsMap.testcase] = this.testCases

    return result
  }
}
