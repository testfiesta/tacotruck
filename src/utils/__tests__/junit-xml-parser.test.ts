import type { JunitParserResult } from '../../types'
import { describe, expect, it, vi } from 'vitest'
import { JunitXmlParser } from '../junit-xml-parser'

describe('junitXmlParser', () => {
  it('should parse XML with root testsuites element', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <testsuites>
        <testsuite name="Suite1" tests="2" failures="1" errors="0" skipped="0" time="0.5">
          <testcase name="Test1" classname="Class1" time="0.2">
            <failure message="Failed assertion" type="AssertionError">Stack trace here</failure>
          </testcase>
          <testcase name="Test2" classname="Class1" time="0.3"/>
        </testsuite>
      </testsuites>
    `

    const parser = new JunitXmlParser().fromXml(xml)
    const result = parser.build()

    const typedResult = result as JunitParserResult
    expect(typedResult.root).toBeDefined()
    expect(typedResult.root.tests).toBe(2)

    expect(typedResult.section).toBeDefined()
    expect(typedResult.section).toHaveLength(1)
    expect(typedResult.section[0].name).toBe('Suite1')
    expect(typedResult.section[0].tests).toBe(2)
    expect(typedResult.section[0].failures).toBe(1)

    expect(typedResult.testcase).toBeDefined()
    expect(typedResult.testcase).toHaveLength(2)
    expect(typedResult.executions[0].status).toBe('failed')
    expect(typedResult.testcase[0].failure).toBeDefined()
    expect(typedResult.executions[1].status).toBe('passed')
  })

  it('should parse XML with single testsuite at root', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <testsuite name="Suite1" tests="2" failures="0" errors="0" skipped="1" time="0.5">
        <testcase name="Test1" classname="Class1" time="0.2"/>
        <testcase name="Test2" classname="Class1" time="0.3">
          <skipped message="Test skipped"/>
        </testcase>
      </testsuite>
    `

    const parser = new JunitXmlParser().fromXml(xml)
    const result = parser.build()

    const typedResult = result as JunitParserResult
    expect(typedResult.root).toBeDefined()
    expect(typedResult.root.tests).toBe(2)

    expect(typedResult.section).toBeDefined()
    expect(typedResult.section).toHaveLength(1)
    expect(typedResult.section[0].name).toBe('Suite1')
    expect(typedResult.section[0].skipped).toBe(1)

    expect(typedResult.testcase).toBeDefined()
    expect(typedResult.testcase).toHaveLength(2)
    expect(typedResult.executions[0].status).toBe('passed')
    expect(typedResult.executions[1].status).toBe('skipped')
    expect(typedResult.testcase[1].skipped).toBeDefined()
  })

  it('should throw error when file path is empty', () => {
    const parser = new JunitXmlParser()
    expect(() => parser.fromFile('')).toThrow()
  })

  it('should parse XML from file', () => {
    const mockFromFile = vi.spyOn(JunitXmlParser.prototype, 'fromFile')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Suite1" tests="1" failures="0" errors="0" skipped="0" time="0.1">
    <testcase name="Test1" classname="Class1" time="0.1"/>
  </testsuite>
</testsuites>`

    mockFromFile.mockImplementation(function (this: any) {
      this.xml = xml
      return this
    })

    const parser = new JunitXmlParser()
    const result = parser.fromFile('dummy/path.xml').build()

    const typedResult = result as JunitParserResult
    expect(typedResult.root).toBeDefined()
    expect(typedResult.section).toBeDefined()
    expect(typedResult.section).toHaveLength(1)
    expect(typedResult.testcase).toBeDefined()
    expect(typedResult.testcase).toHaveLength(1)

    mockFromFile.mockRestore()
  })

  it('should support custom status mapping', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <testsuite name="Suite1" tests="4" failures="1" errors="1" skipped="1" time="1.0">
        <testcase name="Test1" classname="Class1" time="0.2"/>
        <testcase name="Test2" classname="Class1" time="0.3">
          <failure message="Failed assertion" type="AssertionError">Stack trace here</failure>
        </testcase>
        <testcase name="Test3" classname="Class1" time="0.2">
          <error message="Error occurred" type="RuntimeError">Stack trace here</error>
        </testcase>
        <testcase name="Test4" classname="Class1" time="0.3">
          <skipped message="Test skipped"/>
        </testcase>
      </testsuite>
    `

    const testRailStatusMap = {
      passed: 1,
      failed: 5,
      skipped: 2,
      blocked: 3,
      error: 5,
    }

    const parser = new JunitXmlParser({ statusMap: testRailStatusMap }).fromXml(xml)
    const result = parser.build()

    const typedResult = result as JunitParserResult
    expect(typedResult.testcase).toBeDefined()
    expect(typedResult.executions[0].status).toBe(1) // passed
    expect(typedResult.executions[1].status).toBe(5) // failed
    expect(typedResult.executions[2].status).toBe(5) // error (making error and failure the same status)
    expect(typedResult.executions[3].status).toBe(2) // skipped maps to skipped (2)
  })

  it('should support custom XML to JS mapping', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <testsuites>
        <testsuite name="Suite1" tests="1" failures="0" errors="0" skipped="0" time="0.1">
          <testcase name="Test1" classname="Class1" time="0.1"/>
        </testsuite>
      </testsuites>
    `

    const customMapping = {
      suites: 'rootSuite',
      suite: 'testSuites',
      testcase: 'tests',
    }

    const parser = new JunitXmlParser({ xmlToJsMap: customMapping }).fromXml(xml)
    const result = parser.build()

    const typedResult = result as Record<string, any>
    expect(typedResult.rootSuite).toBeDefined()
    expect(typedResult.testSuites).toBeDefined()
    expect(typedResult.testSuites).toHaveLength(1)
    expect(typedResult.tests).toBeDefined()
    expect(typedResult.tests).toHaveLength(1)
  })

  it('should handle multiple test suites', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <testsuites>
        <testsuite name="Suite1" tests="1" failures="0" errors="0" skipped="0" time="0.1">
          <testcase name="Test1" classname="Class1" time="0.1"/>
        </testsuite>
        <testsuite name="Suite2" tests="1" failures="0" errors="0" skipped="0" time="0.2">
          <testcase name="Test2" classname="Class2" time="0.2"/>
        </testsuite>
      </testsuites>
    `

    const parser = new JunitXmlParser().fromXml(xml)
    const result = parser.build()

    const typedResult = result as JunitParserResult
    expect(typedResult.section).toBeDefined()
    expect(typedResult.section).toHaveLength(2)
    expect(typedResult.section[0].name).toBe('Suite1')
    expect(typedResult.section[1].name).toBe('Suite2')
    expect(typedResult.testcase).toBeDefined()
    expect(typedResult.testcase).toHaveLength(2)

    expect(typedResult.root).toBeDefined()
    expect(typedResult.root.tests).toBe(2)
    expect(typedResult.root.time).toBeCloseTo(0.3, 1)
  })

  describe('system outputs support', () => {
    it('should parse system-out and system-err from test cases', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="SystemOutputTests" tests="2" failures="0" errors="0" skipped="0" time="1.0">
          <testcase name="TestWithOutputs" classname="OutputClass" time="0.5">
            <system-out>Standard output content</system-out>
            <system-err>Standard error content</system-err>
          </testcase>
          <testcase name="TestWithoutOutputs" classname="OutputClass" time="0.5"/>
        </testsuite>
      `

      const parser = new JunitXmlParser().fromXml(xml)
      const result = parser.build()

      const typedResult = result as JunitParserResult
      expect(typedResult.testcase).toBeDefined()
      expect(typedResult.testcase).toHaveLength(2)

      const testWithOutputs = typedResult.testcase[0]
      expect(testWithOutputs['system-out']).toBe('Standard output content')
      expect(testWithOutputs['system-err']).toBe('Standard error content')

      const testWithoutOutputs = typedResult.testcase[1]
      expect(testWithoutOutputs['system-out']).toBeUndefined()
      expect(testWithoutOutputs['system-err']).toBeUndefined()
    })

    it('should handle system outputs with CDATA sections', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="CDATATests" tests="1" failures="0" errors="0" skipped="0" time="0.5">
          <testcase name="TestWithCDATA" classname="CDATAClass" time="0.5">
            <system-out><![CDATA[
              Multi-line output
              with special characters: <>&"'
              and formatting
            ]]></system-out>
            <system-err><![CDATA[Error with <tags> and &entities;]]></system-err>
          </testcase>
        </testsuite>
      `

      const parser = new JunitXmlParser().fromXml(xml)
      const result = parser.build()

      const typedResult = result as JunitParserResult
      const testCase = typedResult.testcase[0]

      expect(testCase['system-out']).toContain('Multi-line output')
      expect(testCase['system-out']).toContain('with special characters: <>&"\'')
      expect(testCase['system-err']).toContain('Error with <tags> and &entities;')
    })

    it('should preserve system outputs alongside failure information', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="FailureWithOutputs" tests="1" failures="1" errors="0" skipped="0" time="0.5">
          <testcase name="FailingTestWithOutputs" classname="FailureClass" time="0.5">
            <failure message="Test failed" type="AssertionError">
              Stack trace information
            </failure>
            <system-out>Debug output before failure</system-out>
            <system-err>Error logs during test execution</system-err>
          </testcase>
        </testsuite>
      `

      const parser = new JunitXmlParser().fromXml(xml)
      const result = parser.build()

      const typedResult = result as JunitParserResult
      const testCase = typedResult.testcase[0]

      expect(testCase.failure).toBeDefined()
      expect(testCase.failure?.message).toBe('Test failed')
      expect(testCase.failure?.type).toBe('AssertionError')
      expect(testCase.failure?._text).toContain('Stack trace information')

      expect(testCase['system-out']).toBe('Debug output before failure')
      expect(testCase['system-err']).toBe('Error logs during test execution')

      expect(typedResult.executions[0].status).toBe('failed')
    })

    it('should preserve system outputs alongside error information', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="ErrorWithOutputs" tests="1" failures="0" errors="1" skipped="0" time="0.5">
          <testcase name="ErrorTestWithOutputs" classname="ErrorClass" time="0.5">
            <error message="Runtime error occurred" type="RuntimeError">
              Error stack trace
            </error>
            <system-out>Output before error</system-out>
            <system-err>Critical error in logs</system-err>
          </testcase>
        </testsuite>
      `

      const parser = new JunitXmlParser().fromXml(xml)
      const result = parser.build()

      const typedResult = result as JunitParserResult
      const testCase = typedResult.testcase[0]

      expect(testCase.error).toBeDefined()
      expect(testCase.error?.message).toBe('Runtime error occurred')
      expect(testCase.error?.type).toBe('RuntimeError')
      expect(testCase.error?._text).toContain('Error stack trace')

      expect(testCase['system-out']).toBe('Output before error')
      expect(testCase['system-err']).toBe('Critical error in logs')

      expect(typedResult.executions[0].status).toBe('error')
    })

    it('should preserve system outputs alongside skipped information', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="SkippedWithOutputs" tests="1" failures="0" errors="0" skipped="1" time="0.0">
          <testcase name="SkippedTestWithOutputs" classname="SkippedClass" time="0.0">
            <skipped message="Test was skipped due to condition"/>
            <system-out>Setup output before skip</system-out>
            <system-err>Warning logs before skip</system-err>
          </testcase>
        </testsuite>
      `

      const parser = new JunitXmlParser().fromXml(xml)
      const result = parser.build()

      const typedResult = result as JunitParserResult
      const testCase = typedResult.testcase[0]

      expect(testCase.skipped).toBeDefined()
      expect(testCase.skipped?.message).toBe('Test was skipped due to condition')

      expect(testCase['system-out']).toBe('Setup output before skip')
      expect(testCase['system-err']).toBe('Warning logs before skip')

      expect(typedResult.executions[0].status).toBe('skipped')
    })

    it('should handle empty system outputs', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="EmptyOutputs" tests="1" failures="0" errors="0" skipped="0" time="0.5">
          <testcase name="TestWithEmptyOutputs" classname="EmptyClass" time="0.5">
            <system-out></system-out>
            <system-err></system-err>
          </testcase>
        </testsuite>
      `

      const parser = new JunitXmlParser().fromXml(xml)
      const result = parser.build()

      const typedResult = result as JunitParserResult
      const testCase = typedResult.testcase[0]

      expect(testCase['system-out']).toBe('')
      expect(testCase['system-err']).toBe('')
    })

    it('should handle system outputs in multiple test cases within same suite', () => {
      const xml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="MultipleOutputs" tests="3" failures="1" errors="1" skipped="0" time="1.5">
          <testcase name="PassingTest" classname="MultiClass" time="0.5">
            <system-out>Passing test output</system-out>
            <system-err>Passing test errors</system-err>
          </testcase>
          <testcase name="FailingTest" classname="MultiClass" time="0.5">
            <failure message="Test failed"/>
            <system-out>Failing test output</system-out>
            <system-err>Failing test errors</system-err>
          </testcase>
          <testcase name="ErrorTest" classname="MultiClass" time="0.5">
            <error message="Test error"/>
            <system-out>Error test output</system-out>
            <system-err>Error test errors</system-err>
          </testcase>
        </testsuite>
      `

      const parser = new JunitXmlParser().fromXml(xml)
      const result = parser.build()

      const typedResult = result as JunitParserResult
      expect(typedResult.testcase).toHaveLength(3)

      expect(typedResult.testcase[0]['system-out']).toBe('Passing test output')
      expect(typedResult.testcase[0]['system-err']).toBe('Passing test errors')

      expect(typedResult.testcase[1]['system-out']).toBe('Failing test output')
      expect(typedResult.testcase[1]['system-err']).toBe('Failing test errors')

      expect(typedResult.testcase[2]['system-out']).toBe('Error test output')
      expect(typedResult.testcase[2]['system-err']).toBe('Error test errors')

      expect(typedResult.executions[0].status).toBe('passed')
      expect(typedResult.executions[1].status).toBe('failed')
      expect(typedResult.executions[2].status).toBe('error')
    })
  })
})
