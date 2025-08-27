import type { JunitParserResult } from '../junit-xml-parser'
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
    expect(typedResult.testcase[0].status).toBe('failed')
    expect(typedResult.testcase[0].failure).toBeDefined()
    expect(typedResult.testcase[1].status).toBe('passed')
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
    expect(typedResult.testcase[0].status).toBe('passed')
    expect(typedResult.testcase[1].status).toBe('skipped')
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
    }

    const parser = new JunitXmlParser({ statusMap: testRailStatusMap }).fromXml(xml)
    const result = parser.build()

    const typedResult = result as JunitParserResult
    expect(typedResult.testcase).toBeDefined()
    expect(typedResult.testcase[0].status).toBe(1) // passed
    expect(typedResult.testcase[1].status).toBe(5) // failed
    expect(typedResult.testcase[2].status).toBe(5) // error (making error and failure the same status)
    expect(typedResult.testcase[3].status).toBe(2) // skipped
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
})
