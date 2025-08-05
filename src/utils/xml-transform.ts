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

export interface TransformedData {
  root: {
    name: string
    description?: string
    created_at?: string
  }
  sections: {
    id: string
    name: string
    parentId: string | null
    created_at?: string
  }[]
  cases: {
    id: string
    section_id: string
    title: string
    custom_test_case_id?: string
  }[]
  results: {
    case_id: string
    status_id: number
    comment?: string
    defects?: string
  }[]
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
export function transformXmlData(data: XmlData): TransformedData {
  // Initialize the result structure
  const result: TransformedData = {
    root: {
      name: data.root.name || 'Test Suite',
      description: '',
      created_at: new Date().toISOString(),
    },
    sections: [],
    cases: [],
    results: [],
  }

  // Create sections from the section data
  const sectionMap = new Map<string, string>() // Map to store section name to ID mapping
  
  if (data.section && data.section.length > 0) {
    for (const section of data.section) {
      const sectionId = crypto.randomUUID()
      sectionMap.set(section.name, sectionId)
      
      result.sections.push({
        id: sectionId,
        name: section.name,
        parentId: null,
        created_at: section.timestamp || new Date().toISOString(),
      })
    }
  }

  // Process test cases
  if (data.testcase && data.testcase.length > 0) {
    for (const testCase of data.testcase) {
      // Try to find the section this test case belongs to
      // First, try to match by classname to existing section names
      let sectionId = sectionMap.get(testCase.classname)
      
      // If no direct match, try to find a section that contains the classname
      if (!sectionId) {
        for (const [sectionName, id] of sectionMap.entries()) {
          if (testCase.classname.includes(sectionName) || sectionName.includes(testCase.classname)) {
            sectionId = id
            break
          }
        }
      }
      
      // If still no match, use the first available section or create a default one
      if (!sectionId) {
        if (result.sections.length > 0) {
          sectionId = result.sections[0].id
        } else {
          // Create a default section if none exist
          const defaultSectionId = crypto.randomUUID()
          sectionMap.set('Default Section', defaultSectionId)
          
          result.sections.push({
            id: defaultSectionId,
            name: 'Default Section',
            parentId: null,
            created_at: new Date().toISOString(),
          })
          sectionId = defaultSectionId
        }
      }
      
      // Create a case
      const caseId = crypto.randomUUID()
      result.cases.push({
        id: caseId,
        section_id: sectionId,
        title: testCase.name,
        custom_test_case_id: testCase.name,
      })
      
      // Determine status ID based on test case status
      let statusId = 1 // Default to Passed
      let comment = ''
      let defects = ''
      
      if (testCase.status === 'failed' || testCase.failure) {
        statusId = 5 // Failed
        if (testCase.failure) {
          defects = testCase.failure.message || 'Test failed'
        }
      } else if (testCase.status === 'skipped' || testCase.skipped) {
        statusId = 4 // Retest/skipped
        if (testCase.skipped) {
          comment = testCase.skipped.message || 'Test skipped'
        }
      } else if (testCase.status === 'blocked') {
        statusId = 2 // Blocked
      } else if (testCase.status === 'untested') {
        statusId = 3 // Untested
      }
      
      // Create result
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