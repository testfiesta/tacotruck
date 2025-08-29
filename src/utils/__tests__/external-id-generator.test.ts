import type { TestCaseIdentifier, TestSuiteIdentifier } from '../external-id-generator'
import { beforeEach, describe, expect, it } from 'vitest'
import { ExternalIdGenerator, externalIdGenerator } from '../external-id-generator'

describe('externalIdGenerator', () => {
  let generator: ExternalIdGenerator

  beforeEach(() => {
    generator = new ExternalIdGenerator()
  })

  describe('generateTestCaseId', () => {
    it('should generate consistent IDs for the same test case', () => {
      const identifier: TestCaseIdentifier = {
        name: 'should_pass_test',
        classname: 'com.example.TestClass',
        suiteName: 'TestSuite',
        file: 'test.xml',
      }

      const id1 = generator.generateTestCaseId(identifier)
      const id2 = generator.generateTestCaseId(identifier)

      expect(id1).toBe(id2)
      expect(id1).toMatch(/^tc_[a-f0-9]{16}$/)
    })

    it('should generate different IDs for different test cases', () => {
      const identifier1: TestCaseIdentifier = {
        name: 'test_one',
        classname: 'com.example.TestClass',
      }

      const identifier2: TestCaseIdentifier = {
        name: 'test_two',
        classname: 'com.example.TestClass',
      }

      const id1 = generator.generateTestCaseId(identifier1)
      const id2 = generator.generateTestCaseId(identifier2)

      expect(id1).not.toBe(id2)
    })

    it('should handle minimal identifier information', () => {
      const identifier: TestCaseIdentifier = {
        name: 'minimal_test',
        classname: 'MinimalClass',
      }

      const id = generator.generateTestCaseId(identifier)
      expect(id).toMatch(/^tc_[a-f0-9]{16}$/)
    })

    it('should generate different IDs when classname differs', () => {
      const identifier1: TestCaseIdentifier = {
        name: 'same_test_name',
        classname: 'com.example.ClassA',
      }

      const identifier2: TestCaseIdentifier = {
        name: 'same_test_name',
        classname: 'com.example.ClassB',
      }

      const id1 = generator.generateTestCaseId(identifier1)
      const id2 = generator.generateTestCaseId(identifier2)

      expect(id1).not.toBe(id2)
    })
  })

  describe('generateTestSuiteId', () => {
    it('should generate consistent IDs for the same test suite', () => {
      const identifier: TestSuiteIdentifier = {
        name: 'TestSuite',
        file: 'test-suite.xml',
      }

      const id1 = generator.generateTestSuiteId(identifier)
      const id2 = generator.generateTestSuiteId(identifier)

      expect(id1).toBe(id2)
      expect(id1).toMatch(/^ts_[a-f0-9]{16}$/)
    })

    it('should generate different IDs for different test suites', () => {
      const identifier1: TestSuiteIdentifier = {
        name: 'SuiteA',
      }

      const identifier2: TestSuiteIdentifier = {
        name: 'SuiteB',
      }

      const id1 = generator.generateTestSuiteId(identifier1)
      const id2 = generator.generateTestSuiteId(identifier2)

      expect(id1).not.toBe(id2)
    })

    it('should handle suite with file information', () => {
      const identifier: TestSuiteIdentifier = {
        name: 'FileBasedSuite',
        file: '/path/to/test.xml',
      }

      const id = generator.generateTestSuiteId(identifier)
      expect(id).toMatch(/^ts_[a-f0-9]{16}$/)
    })
  })

  describe('generateHierarchicalTestCaseId', () => {
    it('should generate hierarchical ID with suite context', () => {
      const testCaseIdentifier: TestCaseIdentifier = {
        name: 'test_method',
        classname: 'TestClass',
      }

      const testSuiteIdentifier: TestSuiteIdentifier = {
        name: 'TestSuite',
      }

      const hierarchicalId = generator.generateHierarchicalTestCaseId(
        testCaseIdentifier,
        testSuiteIdentifier,
      )

      expect(hierarchicalId).toMatch(/^ts_[a-f0-9]{16}::tc_[a-f0-9]{16}$/)
    })

    it('should be consistent across calls', () => {
      const testCaseIdentifier: TestCaseIdentifier = {
        name: 'consistent_test',
        classname: 'ConsistentClass',
      }

      const testSuiteIdentifier: TestSuiteIdentifier = {
        name: 'ConsistentSuite',
      }

      const id1 = generator.generateHierarchicalTestCaseId(
        testCaseIdentifier,
        testSuiteIdentifier,
      )
      const id2 = generator.generateHierarchicalTestCaseId(
        testCaseIdentifier,
        testSuiteIdentifier,
      )

      expect(id1).toBe(id2)
    })
  })

  describe('generateRunSpecificTestCaseId', () => {
    it('should include run ID in the generated ID', () => {
      const identifier: TestCaseIdentifier = {
        name: 'run_specific_test',
        classname: 'RunClass',
      }

      const runId = 'run-123'
      const runSpecificId = generator.generateRunSpecificTestCaseId(identifier, runId)

      expect(runSpecificId).toMatch(/^run-123::tc_[a-f0-9]{16}$/)
    })

    it('should generate different IDs for different runs', () => {
      const identifier: TestCaseIdentifier = {
        name: 'same_test',
        classname: 'SameClass',
      }

      const id1 = generator.generateRunSpecificTestCaseId(identifier, 'run-1')
      const id2 = generator.generateRunSpecificTestCaseId(identifier, 'run-2')

      expect(id1).not.toBe(id2)
      expect(id1).toContain('run-1::')
      expect(id2).toContain('run-2::')
    })
  })

  describe('extractBaseTestCaseId', () => {
    it('should extract base ID from run-specific ID', () => {
      const identifier: TestCaseIdentifier = {
        name: 'extract_test',
        classname: 'ExtractClass',
      }

      const baseId = generator.generateTestCaseId(identifier)
      const runSpecificId = generator.generateRunSpecificTestCaseId(identifier, 'run-456')
      const extractedId = generator.extractBaseTestCaseId(runSpecificId)

      expect(extractedId).toBe(baseId)
    })

    it('should return original ID if no run prefix exists', () => {
      const originalId = 'tc_1234567890abcdef'
      const extractedId = generator.extractBaseTestCaseId(originalId)

      expect(extractedId).toBe(originalId)
    })
  })

  describe('validateExternalId', () => {
    it('should validate test case IDs correctly', () => {
      const validTestCaseId = 'tc_1234567890abcdef'
      const invalidTestCaseId = 'invalid_id'

      expect(generator.validateExternalId(validTestCaseId, 'tc')).toBe(true)
      expect(generator.validateExternalId(invalidTestCaseId, 'tc')).toBe(false)
    })

    it('should validate test suite IDs correctly', () => {
      const validTestSuiteId = 'ts_1234567890abcdef'
      const invalidTestSuiteId = 'tc_1234567890abcdef'

      expect(generator.validateExternalId(validTestSuiteId, 'ts')).toBe(true)
      expect(generator.validateExternalId(invalidTestSuiteId, 'ts')).toBe(false)
    })

    it('should reject IDs with wrong length', () => {
      const shortId = 'tc_123'
      const longId = 'tc_1234567890abcdef123'

      expect(generator.validateExternalId(shortId, 'tc')).toBe(false)
      expect(generator.validateExternalId(longId, 'tc')).toBe(false)
    })
  })

  describe('batch operations', () => {
    it('should generate batch test case IDs', () => {
      const identifiers: TestCaseIdentifier[] = [
        { name: 'test1', classname: 'Class1' },
        { name: 'test2', classname: 'Class2' },
        { name: 'test3', classname: 'Class3' },
      ]

      const ids = generator.generateBatchTestCaseIds(identifiers)

      expect(ids).toHaveLength(3)
      expect(ids[0]).toMatch(/^tc_[a-f0-9]{16}$/)
      expect(ids[1]).toMatch(/^tc_[a-f0-9]{16}$/)
      expect(ids[2]).toMatch(/^tc_[a-f0-9]{16}$/)
      expect(new Set(ids).size).toBe(3) // All IDs should be unique
    })

    it('should generate batch test suite IDs', () => {
      const identifiers: TestSuiteIdentifier[] = [
        { name: 'Suite1' },
        { name: 'Suite2' },
        { name: 'Suite3' },
      ]

      const ids = generator.generateBatchTestSuiteIds(identifiers)

      expect(ids).toHaveLength(3)
      expect(ids[0]).toMatch(/^ts_[a-f0-9]{16}$/)
      expect(ids[1]).toMatch(/^ts_[a-f0-9]{16}$/)
      expect(ids[2]).toMatch(/^ts_[a-f0-9]{16}$/)
      expect(new Set(ids).size).toBe(3) // All IDs should be unique
    })
  })

  describe('createTestCaseIdMap', () => {
    it('should create a mapping of test case names to external IDs', () => {
      const identifiers: TestCaseIdentifier[] = [
        { name: 'testA', classname: 'ClassA' },
        { name: 'testB', classname: 'ClassB' },
      ]

      const map = generator.createTestCaseIdMap(identifiers)

      expect(map.size).toBe(2)
      expect(map.has('ClassA::testA')).toBe(true)
      expect(map.has('ClassB::testB')).toBe(true)
      expect(map.get('ClassA::testA')).toMatch(/^tc_[a-f0-9]{16}$/)
      expect(map.get('ClassB::testB')).toMatch(/^tc_[a-f0-9]{16}$/)
    })
  })

  describe('default instance', () => {
    it('should provide a working default instance', () => {
      const identifier: TestCaseIdentifier = {
        name: 'default_test',
        classname: 'DefaultClass',
      }

      const id = externalIdGenerator.generateTestCaseId(identifier)
      expect(id).toMatch(/^tc_[a-f0-9]{16}$/)
    })
  })

  describe('edge cases', () => {
    it('should handle empty strings gracefully', () => {
      const identifier: TestCaseIdentifier = {
        name: '',
        classname: '',
      }

      const id = generator.generateTestCaseId(identifier)
      expect(id).toMatch(/^tc_[a-f0-9]{16}$/)
    })

    it('should handle special characters in names', () => {
      const identifier: TestCaseIdentifier = {
        name: 'test with spaces & symbols!',
        classname: 'com.example.Class$Inner',
      }

      const id = generator.generateTestCaseId(identifier)
      expect(id).toMatch(/^tc_[a-f0-9]{16}$/)
    })

    it('should handle unicode characters', () => {
      const identifier: TestCaseIdentifier = {
        name: 'тест_с_unicode_символами',
        classname: '测试类',
      }

      const id = generator.generateTestCaseId(identifier)
      expect(id).toMatch(/^tc_[a-f0-9]{16}$/)
    })
  })
})
