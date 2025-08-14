import { describe, expect, it } from 'vitest'
import { transformXmlData, transformXmlDataToTestFiesta } from '../xml-transform'

describe('xML Transform Utility', () => {
  it('should transform XML data to the required format', () => {
    // Sample input data
    const inputData = {
      root: {
        name: 'root',
        tests: 1,
        errors: 0,
        failures: 0,
        skipped: 1,
        time: 0.05,
      },
      section: [
        {
          name: 'tests.LoginTests',
          tests: 1,
          errors: 0,
          failures: 0,
          skipped: 1,
          time: 0.05,
          timestamp: undefined,
          file: undefined,
          testcases: [],
        },
      ],
      testcase: [
        {
          name: 'test_case_1',
          classname: 'tests.LoginTests',
          time: 159,
          status: 'skipped',
          skipped: { message: 'Please skip' },
        },
        {
          name: 'test_case_2',
          classname: 'tests.LoginTests',
          time: 650,
          status: 'passed',
        },
        {
          name: 'test_case_3',
          classname: 'tests.LoginTests',
          time: 159,
          status: 'failed',
          failure: { message: 'Fail due to...' },
        },
      ],
    }

    // Transform the data
    const result = transformXmlData(inputData)

    // Verify the structure
    expect(result).toHaveProperty('root')
    expect(result).toHaveProperty('sections')
    expect(result).toHaveProperty('cases')
    expect(result).toHaveProperty('results')

    // Verify sections
    expect(result.sections.length).toBeGreaterThanOrEqual(1)
    expect(result.sections[0]).toHaveProperty('id')
    expect(result.sections[0]).toHaveProperty('name', 'tests.LoginTests')
    expect(result.sections[0]).toHaveProperty('parent_id', null)

    // Verify cases
    expect(result.cases.length).toBe(3)
    result.cases.forEach((testCase) => {
      expect(testCase).toHaveProperty('id')
    })
  })

  it('should transform XML data to TestFiesta format', () => {
    // Sample input data
    const inputData = {
      root: {
        name: 'Test Suite',
        tests: 3,
        errors: 0,
        failures: 1,
        skipped: 1,
        time: 0.968,
      },
      section: [
        {
          name: 'tests.LoginTests',
          tests: 3,
          errors: 0,
          failures: 1,
          skipped: 1,
          time: 0.968,
          timestamp: '2024-01-15T10:00:00Z',
          file: 'login.test.js',
          testcases: [],
        },
      ],
      testcase: [
        {
          name: 'test_case_1',
          classname: 'tests.LoginTests',
          time: 159,
          status: 'skipped',
          skipped: { message: 'Please skip' },
        },
        {
          name: 'test_case_2',
          classname: 'tests.LoginTests',
          time: 650,
          status: 'passed',
        },
        {
          name: 'test_case_3',
          classname: 'tests.LoginTests',
          time: 159,
          status: 'failed',
          failure: { message: 'Fail due to...', type: 'AssertionError' },
        },
      ],
    }

    // Transform the data to TestFiesta format
    const result = transformXmlDataToTestFiesta(inputData)

    // Verify the structure
    expect(result).toHaveProperty('entities')
    expect(result.entities).toHaveProperty('folders')
    expect(result.entities).toHaveProperty('cases')
    expect(result.entities).toHaveProperty('runs')
    expect(result.entities).toHaveProperty('executions')

    // Verify folders
    expect(result.entities.folders!.entries.length).toBe(1)
    expect(result.entities.folders!.entries[0]).toHaveProperty('name', 'tests.LoginTests')
    expect(result.entities.folders!.entries[0]).toHaveProperty('externalId')
    expect(result.entities.folders!.entries[0]).toHaveProperty('source', 'junit-xml')
    expect(result.entities.folders!.entries[0]).toHaveProperty('priority', 'high') // because it has failures

    // Verify cases
    expect(result.entities.cases!.entries.length).toBe(3)
    result.entities.cases!.entries.forEach((testCase) => {
      expect(testCase).toHaveProperty('externalId')
      expect(testCase).toHaveProperty('name')
      expect(testCase).toHaveProperty('source', 'junit-xml')
      expect(testCase).toHaveProperty('folderExternalId')
    })

    // Verify runs
    expect(result.entities.runs!.entries.length).toBe(1)
    expect(result.entities.runs!.entries[0]).toHaveProperty('externalId')
    expect(result.entities.runs!.entries[0]).toHaveProperty('name')
    expect(result.entities.runs!.entries[0]).toHaveProperty('source', 'junit-xml')

    // Verify executions
    expect(result.entities.executions!.entries.length).toBe(3)
    result.entities.executions!.entries.forEach((execution) => {
      expect(execution).toHaveProperty('externalId')
      expect(execution).toHaveProperty('caseRef')
      expect(execution).toHaveProperty('runRef')
      expect(execution).toHaveProperty('source', 'junit-xml')
      expect(execution).toHaveProperty('status')
      expect(execution).toHaveProperty('duration')
    })

    // Verify relationships
    const runId = result.entities.runs!.entries[0].externalId
    const folderId = result.entities.folders!.entries[0].externalId

    result.entities.cases!.entries.forEach((testCase) => {
      expect(testCase.folderExternalId).toBe(folderId)
    })

    result.entities.executions!.entries.forEach((execution) => {
      expect(execution.runRef).toBe(runId)
    })
  })
})
