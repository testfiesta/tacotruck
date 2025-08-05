import { transformXmlData } from '../xml-transform'

// Example input data
const inputData = {
  root: {
    name: 'root',
    tests: 1,
    errors: 0,
    failures: 0,
    skipped: 1,
    time: 0.05
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
      testcases: []
    }
  ],
  testcase: [
    {
      name: 'test_case_1',
      classname: 'tests.LoginTests',
      time: 159,
      status: 'skipped',
      skipped: { message: 'Please skip' }
    },
    {
      name: 'test_case_2',
      classname: 'tests.LoginTests',
      time: 650,
      status: 'passed'
    },
    {
      name: 'test_case_3',
      classname: 'tests.LoginTests',
      time: 159,
      status: 'failed',
      failure: { message: 'Fail due to...' }
    }
  ]
}

// Transform the data
const transformedData = transformXmlData(inputData)

// Output the result
console.log('Transformed Data:')
console.log(JSON.stringify(transformedData, null, 2))

/**
 * The output will have the following structure:
 * {
 *   root: { name: 'root', description: '', created_at: '...' },
 *   sections: [{ id: 'uuid', name: 'tests.LoginTests', parentId: null, created_at: '...' }],
 *   cases: [
 *     { id: 'uuid', section_id: 'section-uuid', title: 'test_case_1', custom_test_case_id: 'test_case_1' },
 *     { id: 'uuid', section_id: 'section-uuid', title: 'test_case_2', custom_test_case_id: 'test_case_2' },
 *     { id: 'uuid', section_id: 'section-uuid', title: 'test_case_3', custom_test_case_id: 'test_case_3' }
 *   ],
 *   results: [
 *     { case_id: 'case-uuid', status_id: 4, comment: 'Please skip', defects: '' },
 *     { case_id: 'case-uuid', status_id: 1, comment: '', defects: '' },
 *     { case_id: 'case-uuid', status_id: 5, comment: '', defects: 'Fail due to...' }
 *   ]
 * }
 * 
 * Status IDs:
 * 1: Passed
 * 2: Blocked
 * 3: Untested
 * 4: Retest/skipped
 * 5: Failed
 */