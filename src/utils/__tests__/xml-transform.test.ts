import { describe, expect, it } from 'vitest'
import { transformXmlData } from '../xml-transform'

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
    expect(result.sections[0]).toHaveProperty('parentId', null)

    // Verify cases
    expect(result.cases.length).toBe(3)
    result.cases.forEach((testCase) => {
      expect(testCase).toHaveProperty('id')
      expect(testCase).toHaveProperty('section_id')
      expect(testCase).toHaveProperty('title')
    })

    // Verify results
    expect(result.results.length).toBe(3)

    // Check status mappings
    const statusCounts = {
      1: 0, // Passed
      2: 0, // Blocked
      3: 0, // Untested
      4: 0, // Retest/skipped
      5: 0, // Failed
    }

    result.results.forEach((result: { status_id: number }) => {
      statusCounts[result.status_id as keyof typeof statusCounts]++
    })

    expect(statusCounts[1]).toBe(1) // One passed test
    expect(statusCounts[4]).toBe(1) // One skipped test
    expect(statusCounts[5]).toBe(1) // One failed test
  })
})
