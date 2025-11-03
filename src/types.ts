export interface TestRailClientOptions {
  baseUrl: string
  apiKey: string
}
export interface TestFiestaClientOptions {
  apiKey: string
  baseUrl?: string
  organizationHandle: string
  projectKey?: string
}

export interface BaseArgs {
  url?: string
}

export interface JunitParserResult {
  [key: string]: RootSuite | null | TestSuite[] | TestCase[] | any
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
  'name': string
  'classname': string
  'time': number
  'failure'?: {
    message?: string
    type?: string
    _text?: string
  }
  'error'?: {
    message?: string
    type?: string
    _text?: string
  }
  'skipped'?: {
    message?: string
  }
  'system-out'?: string
  'system-err'?: string
  'source'?: string
  'externalId'?: string
  'folderExternalId'?: string
}

export interface TestSuite extends RootSuite {
  file?: string
  testcases?: TestCase[]
  externalId?: string
  source?: string
}

// JUnit XML Parser Internal Types
export interface XmlToJsMap {
  suites: string
  suite: string
  testcase: string
}

export interface StatusMap {
  passed: any
  failed: any
  blocked: any
  skipped: any
  error: any
}

export interface JunitXmlParserOptions {
  xmlToJsMap?: XmlToJsMap
  statusMap?: StatusMap
  runId?: string
}

export interface XmlRoot {
  testsuites?: {
    testsuite?: any
  }
  testsuite?: any
}
