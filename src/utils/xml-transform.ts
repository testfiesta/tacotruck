import * as crypto from 'node:crypto'

/**
 * Maps test status to TestRail status IDs:
 * 1: Passed
 * 2: Blocked
 * 3: Untested
 * 4: Retest/skipped
 * 5: Failed
 */
export interface TestCaseResult {
  name: string
  classname: string
  time: number
  status: string
  skipped?: any
  failure?: any
}

export interface TestSection {
  name: string
  tests: number
  errors: number
  failures: number
  skipped: number
  time: number
  timestamp?: string
  file?: string
  testcases: TestCaseResult[]
}

export interface XmlData {
  root: {
    name: string
    tests: number
    errors: number
    failures: number
    skipped: number
    time: number
  }
  section: TestSection[]
  testcase: TestCaseResult[]
}

export interface TransformedTestRailData {
  root: {
    name: string
    description?: string
    created_at?: string
  }
  sections: {
    id: string
    name: string
    parent_id: string | null
    created_at?: string
  }[]
  cases: {
    id: string
    section_id: string
    title: string
    custom_test_case_id?: string
  }[]
  results: {
    case_id: string | number
    status_id: number
    comment?: string
    defects?: string
  }[]
}

interface FolderData {
  name: string
  externalId: string
  source: string
  [key: string]: any
}
interface RunData {
  name: string
  externalId: string
  source: string
  [key: string]: any
}
interface ExecutionData {
  externalId?: string
  caseRef: string
  runRef: string
  source: string
  [key: string]: any
}
interface CaseData {
  name: string
  externalId: string
  source: string
  folderExternalId?: string
  [key: string]: any
}
export interface TransformedTestFiestaData {
  entities: {
    cases?: {
      entries: CaseData[]
    }
    folders?: {
      entries: FolderData[]
    }
    runs?: {
      entries: RunData[]
    }
    executions?: {
      entries: ExecutionData[]
    }
  }
}
/**
 * Transform XML test data to a format compatible with TestRail
 * Status IDs:
 * 1: Passed
 * 2: Blocked
 * 3: Untested
 * 4: Retest/skipped
 * 5: Failed
 *
 * @param data The parsed XML data
 * @returns Transformed data in the required format
 */
export function transformXmlData(data: XmlData): TransformedTestRailData {
  return transformXmlDataToTestRail(data)
}

/**
 * Transform XML test data to a format compatible with TestRail
 * Status IDs:
 * 1: Passed
 * 2: Blocked
 * 3: Untested
 * 4: Retest/skipped
 * 5: Failed
 *
 * @param data The parsed XML data
 * @returns Transformed data in the required format
 */
export function transformXmlDataToTestRail(data: XmlData): TransformedTestRailData {
  const result: TransformedTestRailData = {
    root: {
      name: data.root.name || 'Test Suite',
      description: '',
      created_at: new Date().toISOString(),
    },
    sections: [],
    cases: [],
    results: [],
  }

  const sectionMap = new Map<string, string>()

  if (data.section && data.section.length > 0) {
    for (const section of data.section) {
      const sectionId = crypto.randomUUID()
      sectionMap.set(section.name, sectionId)

      result.sections.push({
        id: sectionId,
        name: section.name,
        parent_id: null,
        created_at: section.timestamp || new Date().toISOString(),
      })
    }
  }

  if (data.testcase && data.testcase.length > 0) {
    for (const testCase of data.testcase) {
      let sectionId = sectionMap.get(testCase.classname)

      if (!sectionId) {
        for (const [sectionName, id] of sectionMap.entries()) {
          if (testCase.classname.includes(sectionName) || sectionName.includes(testCase.classname)) {
            sectionId = id
            break
          }
        }
      }

      if (!sectionId) {
        if (result.sections.length > 0) {
          sectionId = result.sections[0].id
        }
        else {
          const defaultSectionId = crypto.randomUUID()
          sectionMap.set('Default Section', defaultSectionId)

          result.sections.push({
            id: defaultSectionId,
            name: 'Default Section',
            parent_id: null,
            created_at: new Date().toISOString(),
          })
          sectionId = defaultSectionId
        }
      }

      const caseId = crypto.randomUUID()
      result.cases.push({
        id: caseId,
        section_id: sectionId,
        title: testCase.name,
        custom_test_case_id: testCase.name,
      })

      let statusId = 1
      let comment = ''
      let defects = ''

      if (testCase.status === 'failed' || testCase.failure) {
        statusId = 5
        if (testCase.failure) {
          defects = testCase.failure.message || 'Test failed'
        }
      }
      else if (testCase.status === 'skipped' || testCase.skipped) {
        statusId = 4
        if (testCase.skipped) {
          comment = testCase.skipped.message || 'Test skipped'
        }
      }
      else if (testCase.status === 'blocked') {
        statusId = 2
      }
      else if (testCase.status === 'untested') {
        statusId = 3
      }

      result.results.push({
        case_id: caseId,
        status_id: statusId,
        comment,
        defects,
      })
    }
  }

  return result
}

/**
 * Transform XML test data to a format compatible with TestFiesta
 *
 * @param data The parsed XML data
 * @returns Transformed data in the TestFiesta format
 */
export function transformXmlDataToTestFiesta(data: XmlData): TransformedTestFiestaData {
  const result: TransformedTestFiestaData = {
    entities: {
      folders: { entries: [] },
      cases: { entries: [] },
      runs: { entries: [] },
      executions: { entries: [] },
    },
  }

  const folderMap = new Map<string, string>()

  if (data.section && data.section.length > 0) {
    for (const section of data.section) {
      const folderExternalId = `folder-${crypto.randomUUID()}`
      folderMap.set(section.name, folderExternalId)

      const folderData: FolderData = {
        name: section.name,
        externalId: folderExternalId,
        source: 'junit-xml',
        description: `Test suite: ${section.name}`,
        priority: section.failures > 0 ? 'high' : 'medium',
        tests: section.tests,
        failures: section.failures,
        errors: section.errors,
        skipped: section.skipped,
        time: section.time,
        timestamp: section.timestamp || new Date().toISOString(),
      }

      result.entities.folders!.entries.push(folderData)
    }
  }

  const runExternalId = `run-${crypto.randomUUID()}`
  const runData: RunData = {
    name: `${data.root.name || 'Test Suite'} - ${new Date().toISOString().split('T')[0]}`,
    externalId: runExternalId,
    source: 'junit-xml',
    description: `Test execution for ${data.root.name || 'Test Suite'}`,
    environment: 'automated',
    assignee: 'automation-bot@company.com',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + data.root.time * 1000).toISOString(),
    totalTests: data.root.tests,
    totalFailures: data.root.failures,
    totalErrors: data.root.errors,
    totalSkipped: data.root.skipped,
    totalTime: data.root.time,
  }

  result.entities.runs!.entries.push(runData)

  if (data.testcase && data.testcase.length > 0) {
    for (const testCase of data.testcase) {
      let folderExternalId = folderMap.get(testCase.classname)

      if (!folderExternalId) {
        for (const [folderName, id] of folderMap.entries()) {
          if (testCase.classname.includes(folderName) || folderName.includes(testCase.classname)) {
            folderExternalId = id
            break
          }
        }
      }

      if (!folderExternalId) {
        if (result.entities.folders!.entries.length > 0) {
          folderExternalId = result.entities.folders!.entries[0].externalId
        }
        else {
          const defaultFolderExternalId = `folder-default-${crypto.randomUUID()}`
          folderMap.set('Default Folder', defaultFolderExternalId)

          const defaultFolderData: FolderData = {
            name: 'Default Folder',
            externalId: defaultFolderExternalId,
            source: 'junit-xml',
            description: 'Default folder for unassigned test cases',
            priority: 'medium',
          }

          result.entities.folders!.entries.push(defaultFolderData)
          folderExternalId = defaultFolderExternalId
        }
      }

      const caseExternalId = `case-${crypto.randomUUID()}`
      const caseData: CaseData = {
        name: testCase.name,
        externalId: caseExternalId,
        source: 'junit-xml',
        folderExternalId,
        description: `Test case: ${testCase.name}`,
        priority: testCase.status === 'failed' ? 'high' : 'medium',
        classname: testCase.classname,
        time: testCase.time,
        status: testCase.status,
        tags: [testCase.classname.split('.').pop() || 'test', testCase.status],
      }

      result.entities.cases!.entries.push(caseData)

      const executionData: ExecutionData = {
        externalId: `exec-${crypto.randomUUID()}`,
        caseRef: caseExternalId,
        runRef: runExternalId,
        source: 'junit-xml',
        status: testCase.status,
        duration: testCase.time,
        environment: 'automated',
        browser: 'phantomjs',
        comment: testCase.failure?.message || testCase.skipped?.message || '',
        defects: testCase.failure?.message || '',
        failureType: testCase.failure?.type || '',
        failureDetails: testCase.failure?._text || '',
      }

      result.entities.executions!.entries.push(executionData)
    }
  }

  return result
}
