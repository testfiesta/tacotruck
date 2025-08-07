import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import XUnitParser from '../xunit-parser-v2'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}))

describe('xUnitParser', () => {
  const mockXmlContent = `
    <?xml version="1.0" encoding="UTF-8"?>
    <testsuites name="Test Run">
      <testsuite name="Sample Suite" timestamp="2023-07-10T10:00:00">
        <testcase name="Test Case 1">
          <system-out>Output from test case 1</system-out>
        </testcase>
        <testcase name="Test Case 2">
          <error message="Error message">Error details</error>
        </testcase>
        <testcase name="Test Case 3">
          <skipped>Skipped reason</skipped>
        </testcase>
      </testsuite>
    </testsuites>
  `

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(mockXmlContent))
  })

  describe('parseFile', () => {
    it('should read the file and parse its content', () => {
      const parser = new XUnitParser()
      const config = { integration: 'path/to/xml/file.xml' }

      const result = parser.parseFile(config)

      expect(fs.readFileSync).toHaveBeenCalledWith('path/to/xml/file.xml')

      // Verify the structure of the parsed data
      expect(result).toHaveProperty('suites')
      expect(result).toHaveProperty('executions')
      expect(result).toHaveProperty('runs')
    })
  })

  describe('parseContent', () => {
    it('should parse XML content directly', () => {
      const parser = new XUnitParser()
      const config = { integration: 'dummy-path' }

      const result = parser.parseContent(mockXmlContent, config)

      // Verify the structure of the parsed data
      expect(result).toHaveProperty('suites')
      expect(result).toHaveProperty('executions')
      expect(result).toHaveProperty('runs')

      // Verify the content of the parsed data
      expect(result.suites).toHaveLength(1)
      expect(result.suites[0].name).toBe('Sample Suite')
      expect(result.suites[0].created_at).toBe('2023-07-10T10:00:00')

      expect(result.executions).toHaveLength(3)
      expect(result.executions[0].name).toBe('Test Case 1')
      expect(result.executions[1].name).toBe('Test Case 2')
      expect(result.executions[2].name).toBe('Test Case 3')

      expect(result.runs).toHaveLength(1)
      expect(result.runs[0].name).toBe('Test Run')
    })

    it('should handle XML with a single testsuite', () => {
      const singleSuiteXml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="Single Suite" timestamp="2023-07-10T10:00:00">
          <testcase name="Test Case 1"></testcase>
        </testsuite>
      `

      const parser = new XUnitParser()
      const config = { integration: 'dummy-path' }

      const result = parser.parseContent(singleSuiteXml, config)

      expect(result.suites).toHaveLength(1)
      expect(result.suites[0].name).toBe('Single Suite')
      expect(result.executions).toHaveLength(1)
      expect(result.executions[0].name).toBe('Test Case 1')
    })

    it('should handle XML with testcase having error details', () => {
      const errorXml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuites>
          <testsuite name="Error Suite">
            <testcase name="Error Test">
              <error message="Something went wrong">Stack trace here</error>
            </testcase>
          </testsuite>
        </testsuites>
      `

      const parser = new XUnitParser()
      const config = { integration: 'dummy-path' }

      const result = parser.parseContent(errorXml, config)

      expect(result.executions).toHaveLength(1)
      expect(result.executions[0].name).toBe('Error Test')
    })

    it('should apply ignore configuration when provided', () => {
      const parser = new XUnitParser()
      const config = {
        integration: 'dummy-path',
        ignoreConfig: {
          runs: { name: true },
          suites: { created_at: true },
          executions: { name: true },
        },
      }

      const result = parser.parseContent(mockXmlContent, config)

      expect(result.runs[0]).not.toHaveProperty('name')
      expect(result.suites[0]).not.toHaveProperty('created_at')
      result.executions.forEach((execution) => {
        expect(execution).not.toHaveProperty('name')
      })
    })
  })
})
