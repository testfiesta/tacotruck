import { beforeEach, describe, expect, it } from 'vitest'
import { TestFiestaClient } from '../../src/clients/testfiesta'

describe('testFiestaClient', () => {
  const mockOptions = {
    apiKey: 'test-api-key',
    domain: 'https://api.testfiesta.com',
    organizationHandle: 'test-org',
  }

  let client: TestFiestaClient

  beforeEach(() => {
    client = new TestFiestaClient(mockOptions)
  })

  describe('getProjects', () => {
    it('should fetch projects with pagination', async () => {
      const result = await client.getProjects({ limit: 5, offset: 0 })

      expect(result).toMatchObject({
        count: 25,
        items: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.stringContaining('Test Project'),
            key: expect.stringContaining('TEST_PROJECT'),
          }),
        ]),
        nextOffset: expect.any(Number),
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getProjects()

      expect(result).toMatchObject({
        count: 25,
        items: expect.any(Array),
        nextOffset: expect.any(Number),
      })
    })

    it('should return null nextOffset when no more items', async () => {
      const result = await client.getProjects({ limit: 10, offset: 20 })

      expect(result).toMatchObject({
        count: 25,
        items: expect.any(Array),
        nextOffset: null,
      })
    })
  })

  describe('getCases', () => {
    it('should fetch test cases with pagination', async () => {
      const result = await client.getCases('TEST_PROJECT', { limit: 5, offset: 0 })

      expect(result).toMatchObject({
        count: 1355,
        items: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            projectUid: expect.any(Number),
            name: expect.stringContaining('WCAG'),
            externalId: expect.stringMatching(/^tc_\d{4}$/),
            steps: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(Number),
                title: expect.any(String),
                description: expect.any(String),
                shared: false,
                children: expect.any(Array),
              }),
            ]),
            customFields: expect.objectContaining({
              expectedResultByStep: false,
              expectedResult: expect.any(String),
            }),
            tags: expect.arrayContaining([
              expect.objectContaining({
                uid: expect.any(Number),
                name: expect.any(String),
                entityTypes: expect.any(Array),
              }),
            ]),
          }),
        ]),
        nextOffset: expect.any(Number),
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getCases('TEST_PROJECT')

      expect(result).toMatchObject({
        count: 1355,
        items: expect.any(Array),
        nextOffset: expect.any(Number),
      })
    })

    it('should return null nextOffset when reaching end of cases', async () => {
      const result = await client.getCases('TEST_PROJECT', { limit: 10, offset: 1350 })

      expect(result).toMatchObject({
        count: 1355,
        items: expect.any(Array),
        nextOffset: null,
      })
    })
  })

  describe('getCase', () => {
    it('should fetch a single test case by UID', async () => {
      const result = await client.getCase('TEST_PROJECT', 1345)

      expect(result).toMatchObject({
        uid: 1345,
        projectUid: expect.any(Number),
        name: expect.stringContaining('WCAG'),
        externalId: expect.stringMatching(/^tc_\d{4}$/),
        steps: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            title: expect.any(String),
            description: expect.any(String),
            shared: false,
            children: expect.any(Array),
          }),
        ]),
        customFields: expect.objectContaining({
          expectedResultByStep: false,
          expectedResult: expect.any(String),
        }),
        tags: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.any(String),
            entityTypes: expect.any(Array),
          }),
        ]),
        testCaseRef: 1345,
        version: 1,
        active: true,
        status: 24,
        priority: 3,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        createdBy: expect.any(String),
      })
    })

    it('should fetch different test cases with different UIDs', async () => {
      const result = await client.getCase('TEST_PROJECT', 1400)

      expect(result).toMatchObject({
        uid: 1400,
        name: expect.stringContaining('Case 1400'),
        testCaseRef: 1400,
        externalId: 'tc_1400',
      })
    })

    it('should return original case name for base UID', async () => {
      const result = await client.getCase('TEST_PROJECT', 1345)

      expect(result.name).not.toContain('Case 1345')
      expect(result.name).toContain('WCAG-015')
    })
  })

  describe('getRuns', () => {
    it('should fetch test runs with pagination', async () => {
      const result = await client.getRuns('TEST_PROJECT', { limit: 5, offset: 0 })

      expect(result).toMatchObject({
        count: 100,
        items: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.stringContaining('Release'),
            systemType: 'run',
            projectUid: expect.any(Number),
            customFields: expect.objectContaining({
              dueAt: expect.any(String),
              status: expect.any(Number),
              priority: expect.any(Number),
              progress: expect.any(Number),
              caseCount: expect.any(Number),
              frequency: expect.objectContaining({
                1: expect.any(Number),
                2: expect.any(Number),
                3: expect.any(Number),
                4: expect.any(Number),
              }),
            }),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ]),
        nextOffset: expect.any(Number),
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getRuns('TEST_PROJECT')

      expect(result).toMatchObject({
        count: 100,
        items: expect.any(Array),
        nextOffset: expect.any(Number),
      })
    })

    it('should return null nextOffset when reaching end of runs', async () => {
      const result = await client.getRuns('TEST_PROJECT', { limit: 10, offset: 95 })

      expect(result).toMatchObject({
        count: 100,
        items: expect.any(Array),
        nextOffset: null,
      })
    })

    it('should return different run names for different items', async () => {
      const result = await client.getRuns('TEST_PROJECT', { limit: 3, offset: 0 })

      expect(result.items).toHaveLength(3)
      expect(result.items[0].name).toBe('Release v1.6.9')
      expect(result.items[1].name).toContain('Release v1.6.10')
      expect(result.items[2].name).toContain('Release v1.6.11')
    })

    it('should return progressive progress values', async () => {
      const result = await client.getRuns('TEST_PROJECT', { limit: 3, offset: 0 })

      expect(result.items[0].customFields.progress).toBe(57)
      expect(result.items[1].customFields.progress).toBe(62)
      expect(result.items[2].customFields.progress).toBe(67)
    })
  })

  describe('getRun', () => {
    it('should fetch a single test run by ID', async () => {
      const result = await client.getRun('TEST_PROJECT', 252)

      expect(result).toMatchObject({
        uid: 252,
        name: 'Release v1.6.9',
        systemType: 'run',
        projectUid: expect.any(Number),
        description: null,
        entityTypes: null,
        parentUid: null,
        archivedAt: null,
        deletedAt: null,
        slug: null,
        customFields: expect.objectContaining({
          dueAt: expect.any(String),
          status: 12,
          priority: 9,
          progress: 57,
          caseCount: 88,
          frequency: expect.objectContaining({
            1: 17,
            2: 24,
            3: 21,
            4: 26,
          }),
        }),
        externalCreatedAt: null,
        externalUpdatedAt: null,
        externalId: null,
        source: null,
        integrationUid: null,
        position: null,
        path: null,
        aggregates: expect.any(Object),
        createdBy: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should fetch different test runs with different IDs', async () => {
      const result = await client.getRun('TEST_PROJECT', 300)

      expect(result).toMatchObject({
        uid: 300,
        name: expect.stringContaining('Release v1.6.57'),
        customFields: expect.objectContaining({
          progress: expect.any(Number),
          caseCount: expect.any(Number),
        }),
      })
    })

    it('should return original run name for base ID', async () => {
      const result = await client.getRun('TEST_PROJECT', 252)

      expect(result.name).toBe('Release v1.6.9')
      expect(result.name).not.toContain('Run 252')
    })

    it('should return different progress values for different run IDs', async () => {
      const baseRun = await client.getRun('TEST_PROJECT', 252)
      const nextRun = await client.getRun('TEST_PROJECT', 253)

      expect(baseRun.customFields.progress).toBe(57)
      expect(nextRun.customFields.progress).toBe(62)
      expect(nextRun.customFields.caseCount).toBe(90)
    })
  })

  describe('getMilestones', () => {
    it('should fetch milestones with pagination', async () => {
      const result = await client.getMilestones('TEST_PROJECT', { limit: 5, offset: 0 })

      expect(result).toMatchObject({
        count: 100,
        items: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.stringContaining('Sprint'),
            systemType: 'milestone',
            projectUid: expect.any(Number),
            customFields: expect.objectContaining({
              dueAt: expect.any(String),
              status: expect.any(Number),
              tagUids: expect.any(Array),
              progress: expect.any(Number),
              syncedAt: expect.any(String),
              frequency: expect.objectContaining({
                1: expect.any(Number),
                2: expect.any(Number),
                3: expect.any(Number),
                4: expect.any(Number),
              }),
              startDate: expect.any(String),
            }),
            archivedAt: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ]),
        nextOffset: expect.any(Number),
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getMilestones('TEST_PROJECT')

      expect(result).toMatchObject({
        count: 100,
        items: expect.any(Array),
        nextOffset: expect.any(Number),
      })
    })

    it('should return null nextOffset when reaching end of milestones', async () => {
      const result = await client.getMilestones('TEST_PROJECT', { limit: 10, offset: 95 })

      expect(result).toMatchObject({
        count: 100,
        items: expect.any(Array),
        nextOffset: null,
      })
    })

    it('should return different milestone names for different items', async () => {
      const result = await client.getMilestones('TEST_PROJECT', { limit: 3, offset: 0 })

      expect(result.items).toHaveLength(3)
      expect(result.items[0].name).toBe('Sprint v1.0.0')
      expect(result.items[1].name).toContain('Sprint v1.1.1')
      expect(result.items[2].name).toContain('Sprint v1.2.2')
    })

    it('should return decreasing progress values', async () => {
      const result = await client.getMilestones('TEST_PROJECT', { limit: 3, offset: 0 })

      expect(result.items[0].customFields.progress).toBe(100)
      expect(result.items[1].customFields.progress).toBe(90)
      expect(result.items[2].customFields.progress).toBe(80)
    })
  })

  describe('getMilestone', () => {
    it('should fetch a single milestone by ID', async () => {
      const result = await client.getMilestone('TEST_PROJECT', 383)

      expect(result).toMatchObject({
        uid: 383,
        name: 'Sprint v1.0.0',
        systemType: 'milestone',
        projectUid: expect.any(Number),
        description: null,
        entityTypes: null,
        parentUid: null,
        archivedAt: expect.any(String),
        deletedAt: null,
        slug: null,
        customFields: expect.objectContaining({
          dueAt: expect.any(String),
          status: 23,
          tagUids: expect.arrayContaining([3]),
          progress: 100,
          syncedAt: expect.any(String),
          frequency: expect.objectContaining({
            1: 1123,
            2: 1229,
            3: 1158,
            4: 1094,
          }),
          startDate: expect.any(String),
        }),
        externalCreatedAt: null,
        externalUpdatedAt: null,
        externalId: null,
        source: null,
        integrationUid: null,
        position: null,
        path: null,
        aggregates: expect.any(Object),
        createdBy: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should fetch different milestones with different IDs', async () => {
      const result = await client.getMilestone('TEST_PROJECT', 400)

      expect(result).toMatchObject({
        uid: 400,
        name: expect.stringContaining('Sprint v1.17.0'),
        customFields: expect.objectContaining({
          progress: expect.any(Number),
          status: expect.any(Number),
          tagUids: expect.any(Array),
        }),
      })
    })

    it('should return original milestone name for base ID', async () => {
      const result = await client.getMilestone('TEST_PROJECT', 383)

      expect(result.name).toBe('Sprint v1.0.0')
      expect(result.name).not.toContain('Milestone 383')
    })

    it('should return different progress and status values for different milestone IDs', async () => {
      const baseMilestone = await client.getMilestone('TEST_PROJECT', 383)
      const nextMilestone = await client.getMilestone('TEST_PROJECT', 384)

      expect(baseMilestone.customFields.progress).toBe(100)
      expect(nextMilestone.customFields.progress).toBe(95)
      expect(baseMilestone.customFields.status).toBe(23)
      expect(nextMilestone.customFields.status).toBe(22)
    })
  })

  describe('createCases', () => {
    it('should create multiple test cases successfully', async () => {
      const casesToCreate = [
        {
          name: 'test demo demo demo demo 2',
          projectId: '1',
          source: 'github',
          externalId: '1',
          parentId: 134,
        },
        {
          name: 'test demo demo demo demo 3',
          projectId: '1',
          source: 'github',
          externalId: '2',
          parentId: 134,
        },
      ]

      const result = await client.createCases('TEST_PROJECT', casesToCreate)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        externalId: '1',
        source: 'github',
        name: 'test demo demo demo demo 2',
        customFields: null,
        projectUid: 1,
        parentUid: 134,
        repoUid: null,
        priority: 1,
        active: true,
        version: 1,
        createdBy: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        uid: 1362,
        testCaseRef: 1362,
        steps: [],
        event: null,
        link: null,
        testCaseTemplateUid: null,
        externalCreatedAt: null,
        externalUpdatedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        status: null,
        syncedAt: null,
        testResultTemplateUid: null,
      })

      expect(result[1]).toMatchObject({
        externalId: '2',
        source: 'github',
        name: 'test demo demo demo demo 3',
        customFields: null,
        projectUid: 1,
        parentUid: 134,
        repoUid: null,
        priority: 1,
        active: true,
        version: 1,
        createdBy: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        uid: 1363,
        testCaseRef: 1363,
        steps: [],
        event: null,
        link: null,
        testCaseTemplateUid: null,
        externalCreatedAt: null,
        externalUpdatedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        status: null,
        syncedAt: null,
        testResultTemplateUid: null,
      })
    })

    it('should apply default values for optional fields', async () => {
      const casesToCreate = [
        {
          name: 'Test Case with Minimal Data',
          projectId: '1',
          source: 'github',
          parentId: 134,
        },
      ]

      const result = await client.createCases('TEST_PROJECT', casesToCreate)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        name: 'Test Case with Minimal Data',
        projectUid: 1,
        source: 'github',
        steps: [],
        repoUid: null,
        customFields: null,
        externalId: '1',
        parentUid: 134,
        uid: 1362,
        testCaseRef: 1362,
        priority: 1,
        active: true,
        version: 1,
        createdBy: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      })
    })

    it('should handle custom fields and steps when provided', async () => {
      const casesToCreate = [
        {
          name: 'Test Case with Custom Data',
          projectId: '1',
          source: 'github',
          externalId: 'custom-123',
          parentId: 999,
          steps: [
            { id: 1, title: 'Step 1', description: 'First step' },
            { id: 2, title: 'Step 2', description: 'Second step' },
          ],
          customFields: {
            priority: 'high',
            category: 'regression',
            tags: ['api', 'authentication'],
          },
          repoUID: '456',
        },
      ]

      const result = await client.createCases('TEST_PROJECT', casesToCreate)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        name: 'Test Case with Custom Data',
        projectUid: 1,
        source: 'github',
        externalId: 'custom-123',
        parentUid: 999,
        steps: [
          { id: 1, title: 'Step 1', description: 'First step' },
          { id: 2, title: 'Step 2', description: 'Second step' },
        ],
        customFields: {
          priority: 'high',
          category: 'regression',
          tags: ['api', 'authentication'],
        },
        repoUid: 456, // Converted from string to number
        uid: 1362,
        testCaseRef: 1362,
      })
    })

    it('should create single case using createCase method', async () => {
      const caseToCreate = {
        name: 'Single Test Case',
        projectId: '1',
        source: 'github',
        externalId: 'single-case-1',
        parentId: 100,
      }

      const result = await client.createCase('TEST_PROJECT', caseToCreate)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        name: 'Single Test Case',
        projectUid: 1,
        source: 'github',
        externalId: 'single-case-1',
        parentUid: 100,
        steps: [],
        customFields: null,
        repoUid: null,
        uid: 1362,
        testCaseRef: 1362,
        priority: 1,
        active: true,
        version: 1,
        createdBy: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      })
    })

    it('should validate required fields and throw error for invalid input', async () => {
      const invalidCases = [
        {
          // Missing required 'name' field
          projectId: '1',
          source: 'github',
          parentId: 134,
        },
      ]

      await expect(client.createCases('TEST_PROJECT', invalidCases as any))
        .rejects
        .toThrow('Invalid case input')
    })

    it('should validate projectId as string and throw error for invalid type', async () => {
      const invalidCases = [
        {
          name: 'Valid Name',
          projectId: 123, // Should be string, not number
          source: 'github',
          parentId: 134,
        },
      ]

      await expect(client.createCases('TEST_PROJECT', invalidCases as any))
        .rejects
        .toThrow('Invalid case input')
    })

    it('should validate source field and throw error when missing', async () => {
      const invalidCases = [
        {
          name: 'Valid Name',
          projectId: '1',
          parentId: 134,
          // Missing required 'source' field
        },
      ]

      await expect(client.createCases('TEST_PROJECT', invalidCases as any))
        .rejects
        .toThrow('Invalid case input')
    })

    it('should validate parentId field and throw error when missing', async () => {
      const invalidCases = [
        {
          name: 'Valid Name',
          projectId: '1',
          source: 'github',
          // Missing required 'parentId' field
        },
      ]

      await expect(client.createCases('TEST_PROJECT', invalidCases as any))
        .rejects
        .toThrow('Invalid case input')
    })

    it('should handle empty array input', async () => {
      const result = await client.createCases('TEST_PROJECT', [])

      expect(result).toEqual([])
    })

    it('should generate sequential UIDs for multiple cases', async () => {
      const casesToCreate = [
        {
          name: 'First Case',
          projectId: '1',
          source: 'github',
          parentId: 100,
        },
        {
          name: 'Second Case',
          projectId: '1',
          source: 'github',
          parentId: 101,
        },
        {
          name: 'Third Case',
          projectId: '1',
          source: 'github',
          parentId: 102,
        },
      ]

      const result = await client.createCases('TEST_PROJECT', casesToCreate)

      expect(result).toHaveLength(3)
      expect(result[0].uid).toBe(1362)
      expect(result[0].testCaseRef).toBe(1362)
      expect(result[1].uid).toBe(1363)
      expect(result[1].testCaseRef).toBe(1363)
      expect(result[2].uid).toBe(1364)
      expect(result[2].testCaseRef).toBe(1364)
    })
  })

  describe('getFolders', () => {
    it('should fetch folders with pagination', async () => {
      const result = await client.getFolders('TEST_PROJECT', { limit: 5, offset: 0 })

      expect(result).toMatchObject({
        count: 217,
        items: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.stringContaining('Test'),
            systemType: 'folder',
            projectUid: expect.any(Number),
            entityTypes: ['cases'],
            parentUid: expect.any(Number),
            customFields: expect.objectContaining({
              time: expect.any(Number),
              tests: expect.any(Number),
              errors: expect.any(Number),
              skipped: expect.any(Number),
              failures: expect.any(Number),
              testcases: expect.any(Array),
            }),
            externalCreatedAt: expect.any(String),
            externalUpdatedAt: expect.any(String),
            externalId: expect.stringMatching(/^folder-[a-f0-9]{8}$/),
            source: 'junit-xml',
            integrationUid: null,
            position: null,
            path: null,
            aggregates: {},
            createdBy: null,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ]),
        nextOffset: expect.any(Number),
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getFolders('TEST_PROJECT')

      expect(result).toMatchObject({
        count: 217,
        items: expect.any(Array),
        nextOffset: expect.any(Number),
      })
    })

    it('should return null nextOffset when reaching end of folders', async () => {
      const result = await client.getFolders('TEST_PROJECT', { limit: 10, offset: 210 })

      expect(result).toMatchObject({
        count: 217,
        items: expect.any(Array),
        nextOffset: null,
      })
    })

    it('should return different folder names for different items', async () => {
      const result = await client.getFolders('TEST_PROJECT', { limit: 3, offset: 0 })

      expect(result.items).toHaveLength(3)
      expect(result.items[0].name).toBe('Test Cases Folder')
      expect(result.items[1].name).toContain('Test Folder 2')
      expect(result.items[2].name).toContain('Test Folder 3')
    })

    it('should return progressive test counts', async () => {
      const result = await client.getFolders('TEST_PROJECT', { limit: 3, offset: 0 })

      expect(result.items[0].customFields.tests).toBe(25)
      expect(result.items[1].customFields.tests).toBe(30)
      expect(result.items[2].customFields.tests).toBe(35)
    })
  })

  describe('getFolder', () => {
    it('should fetch a single folder by ID', async () => {
      const result = await client.getFolder('TEST_PROJECT', 100)

      expect(result).toMatchObject({
        uid: 100,
        name: 'Test Cases Folder',
        systemType: 'folder',
        projectUid: expect.any(Number),
        description: null,
        entityTypes: ['cases'],
        parentUid: 5,
        archivedAt: null,
        deletedAt: null,
        slug: null,
        customFields: expect.objectContaining({
          time: 0.004178,
          tests: 25,
          errors: 0,
          skipped: 0,
          failures: 0,
          testcases: [],
        }),
        externalCreatedAt: expect.any(String),
        externalUpdatedAt: expect.any(String),
        externalId: expect.stringMatching(/^folder-[a-f0-9]{8}$/),
        source: 'junit-xml',
        integrationUid: null,
        position: null,
        path: null,
        aggregates: {},
        createdBy: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should fetch different folders with different IDs', async () => {
      const result = await client.getFolder('TEST_PROJECT', 105)

      expect(result).toMatchObject({
        uid: 105,
        name: expect.stringContaining('Test Folder 105'),
        customFields: expect.objectContaining({
          tests: expect.any(Number),
          time: expect.any(Number),
          testcases: expect.any(Array),
        }),
        aggregates: {},
      })
    })

    it('should return original folder name for base ID', async () => {
      const result = await client.getFolder('TEST_PROJECT', 100)

      expect(result.name).toBe('Test Cases Folder')
      expect(result.name).not.toContain('Folder 100')
    })

    it('should return different test counts for different folder IDs', async () => {
      const baseFolder = await client.getFolder('TEST_PROJECT', 100)
      const nextFolder = await client.getFolder('TEST_PROJECT', 101)

      expect(baseFolder.customFields.tests).toBe(25)
      expect(nextFolder.customFields.tests).toBe(30)
      expect(baseFolder.customFields.time).toBe(0.004178)
      expect(nextFolder.customFields.time).toBe(0.005178)
    })
  })

  describe('createFolder', () => {
    it('should create a folder successfully', async () => {
      const folderToCreate = {
        name: 'New Test Folder',
        externalId: 'new_folder_001',
        source: 'junit-xml',
        customFields: {
          time: 0.005,
          tests: 10,
          errors: 0,
          skipped: 0,
          failures: 0,
          priority: 'medium',
          timestamp: '2025-09-22T06:50:45.000Z',
        },
        parentUid: 100,
        projectUid: 1,
        position: 5,
        integrationUid: 2,
      }

      const result = await client.createFolder('TEST_PROJECT', folderToCreate)

      expect(result).toMatchObject({
        uid: 150,
        name: 'New Test Folder',
        slug: 'new-test-folder',
        source: 'junit-xml',
        externalId: 'new_folder_001',
        parentUid: 100,
        customFields: {
          time: 0.005,
          tests: 10,
          errors: 0,
          skipped: 0,
          failures: 0,
        },
        projectUid: 1,
        entityTypes: ['cases'],
        systemType: 'folder',
        position: 5,
        path: '100.150',
        integrationUid: 2,
        description: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        archivedAt: null,
        deletedAt: null,
        externalCreatedAt: null,
        externalUpdatedAt: null,
        aggregates: {},
        createdBy: null,
      })
    })

    it('should create folder with minimal required fields', async () => {
      const folderToCreate = {
        name: 'Minimal Folder',
        parentUid: 0,
        projectUid: 1,
      }

      const result = await client.createFolder('TEST_PROJECT', folderToCreate)

      expect(result).toMatchObject({
        uid: 150,
        name: 'Minimal Folder',
        slug: 'minimal-folder',
        source: null,
        externalId: null,
        parentUid: 0,
        customFields: null,
        projectUid: 1,
        entityTypes: ['cases'],
        systemType: 'folder',
        position: null,
        path: '0.150',
        integrationUid: null,
        description: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        archivedAt: null,
        deletedAt: null,
        externalCreatedAt: null,
        externalUpdatedAt: null,
        aggregates: {},
        createdBy: null,
      })
    })

    it('should validate required fields and throw error for invalid input', async () => {
      const invalidFolder = {
        parentUid: 100,
        projectUid: 1,
      }

      await expect(client.createFolder('TEST_PROJECT', invalidFolder as any))
        .rejects
        .toThrow('Invalid folder input')
    })

    it('should validate parentUid as number and throw error for invalid type', async () => {
      const invalidFolder = {
        name: 'Valid Name',
        parentUid: 'invalid',
        projectUid: 1,
      }

      await expect(client.createFolder('TEST_PROJECT', invalidFolder as any))
        .rejects
        .toThrow('Invalid folder input')
    })

    it('should validate projectUid field and throw error when missing', async () => {
      const invalidFolder = {
        name: 'Valid Name',
        parentUid: 100,
      }

      await expect(client.createFolder('TEST_PROJECT', invalidFolder as any))
        .rejects
        .toThrow('Invalid folder input')
    })
  })

  describe('deleteFolder', () => {
    it('should delete a folder successfully', async () => {
      const result = await client.deleteFolder('TEST_PROJECT', 100)

      expect(result).toBeUndefined()
    })

    it('should handle deletion of different folder IDs', async () => {
      await expect(client.deleteFolder('TEST_PROJECT', 105)).resolves.toBeUndefined()
      await expect(client.deleteFolder('TEST_PROJECT', 200)).resolves.toBeUndefined()
    })
  })

  describe('getTags', () => {
    it('should fetch tags with pagination', async () => {
      const result = await client.getTags({ limit: 5, offset: 0 })

      expect(result).toMatchObject({
        count: 4,
        items: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.stringMatching(/^(automated|unit|functional|exploratory)$/),
            systemType: 'tag',
            slug: null,
            description: null,
            entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
            parentUid: null,
            projectUid: null,
            customFields: null,
            externalCreatedAt: null,
            externalUpdatedAt: null,
            externalId: null,
            source: null,
            integrationUid: null,
            position: null,
            path: null,
            aggregates: {},
            createdBy: null,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            archivedAt: null,
            deletedAt: null,
          }),
        ]),
        nextOffset: null,
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getTags()

      expect(result).toMatchObject({
        count: 4,
        items: expect.any(Array),
        nextOffset: null,
      })
    })

    it('should return null nextOffset when reaching end of tags', async () => {
      const result = await client.getTags({ limit: 10, offset: 0 })

      expect(result).toMatchObject({
        count: 4,
        items: expect.any(Array),
        nextOffset: null,
      })
    })

    it('should return different tag names for different items', async () => {
      const result = await client.getTags({ limit: 3, offset: 0 })

      expect(result.items).toHaveLength(3)
      expect(result.items[0].name).toBe('automated')
      expect(result.items[1].name).toBe('unit')
      expect(result.items[2].name).toBe('functional')
    })
  })

  describe('getTag', () => {
    it('should fetch a single tag by ID', async () => {
      const result = await client.getTag(1)

      expect(result).toMatchObject({
        uid: 1,
        name: 'automated',
        slug: null,
        description: null,
        entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
        parentUid: null,
        projectUid: null,
        customFields: null,
        externalCreatedAt: null,
        externalUpdatedAt: null,
        externalId: null,
        source: null,
        integrationUid: null,
        position: null,
        path: null,
        aggregates: {},
        createdBy: null,
        systemType: 'tag',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        archivedAt: null,
        deletedAt: null,
      })
    })

    it('should fetch different tags with different IDs', async () => {
      const result = await client.getTag(2)

      expect(result).toMatchObject({
        uid: 2,
        name: 'unit',
        slug: null,
        description: null,
        entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
        systemType: 'tag',
      })
    })

    it('should return original tag name for base ID', async () => {
      const result = await client.getTag(1)

      expect(result.name).toBe('automated')
      expect(result.name).not.toContain('Tag 1')
    })
  })

  describe('createTag', () => {
    it('should create a tag successfully', async () => {
      const tagToCreate = {
        name: 'New Test Tag',
        description: 'A new test tag for automation',
        entityTypes: ['cases', 'runs'],
      }

      const result = await client.createTag(tagToCreate)

      expect(result).toMatchObject({
        uid: 200,
        name: 'New Test Tag',
        slug: null,
        description: 'A new test tag for automation',
        entityTypes: ['cases', 'runs'],
        parentUid: null,
        projectUid: null,
        customFields: null,
        systemType: 'tag',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        archivedAt: null,
        deletedAt: null,
        externalCreatedAt: null,
        externalUpdatedAt: null,
        externalId: null,
        source: null,
        integrationUid: null,
        position: null,
        path: null,
        aggregates: {},
        createdBy: null,
      })
    })

    it('should create tag with minimal required fields', async () => {
      const tagToCreate = {
        name: 'Minimal Tag',
      }

      const result = await client.createTag(tagToCreate)

      expect(result).toMatchObject({
        uid: 200,
        name: 'Minimal Tag',
        slug: null,
        description: null,
        entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
        parentUid: null,
        projectUid: null,
        customFields: null,
        systemType: 'tag',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        archivedAt: null,
        deletedAt: null,
        externalCreatedAt: null,
        externalUpdatedAt: null,
        externalId: null,
        source: null,
        integrationUid: null,
        position: null,
        path: null,
        aggregates: {},
        createdBy: null,
      })
    })

    it('should validate required fields and throw error for invalid input', async () => {
      const invalidTag = {
        // Missing required 'name' field
        description: 'Invalid tag',
      }

      await expect(client.createTag(invalidTag as any))
        .rejects
        .toThrow('Invalid tag input')
    })

    it('should validate name field and throw error when missing', async () => {
      const invalidTag = {
        name: '', // Empty name should fail validation
        description: 'Valid description',
      }

      await expect(client.createTag(invalidTag as any))
        .rejects
        .toThrow('Invalid tag input')
    })
  })

  describe('updateTag', () => {
    it('should update a tag successfully', async () => {
      const updateData = {
        name: 'Updated Tag Name',
        description: 'Updated description',
        entityTypes: ['cases', 'executions'],
        archived: false,
      }

      const result = await client.updateTag(1, updateData)

      expect(result).toMatchObject({
        uid: 1,
        name: 'Updated Tag Name',
        slug: null,
        description: 'Updated description',
        entityTypes: ['cases', 'executions'],
        archivedAt: null,
        updatedAt: expect.any(String),
      })
    })

    it('should update tag with partial data', async () => {
      const updateData = {
        name: 'Partially Updated Tag',
      }

      const result = await client.updateTag(1, updateData)

      expect(result).toMatchObject({
        uid: 1,
        name: 'Partially Updated Tag',
        slug: null,
        description: null, // Should remain unchanged
        entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
        updatedAt: expect.any(String),
      })
    })

    it('should archive a tag successfully', async () => {
      const updateData = {
        archived: true,
      }

      const result = await client.updateTag(1, updateData)

      expect(result).toMatchObject({
        uid: 1,
        name: 'automated',
        slug: null,
        description: null,
        entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
        archivedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should validate update data and throw error for invalid input', async () => {
      const invalidUpdate = {
        name: '', // Empty name should fail validation
      }

      await expect(client.updateTag(1, invalidUpdate as any))
        .rejects
        .toThrow('Invalid tag input')
    })
  })

  describe('deleteTag', () => {
    it('should delete a tag successfully', async () => {
      const result = await client.deleteTag(1)

      expect(result).toBeUndefined()
    })

    it('should handle deletion of different tag IDs', async () => {
      await expect(client.deleteTag(5)).resolves.toBeUndefined()
      await expect(client.deleteTag(10)).resolves.toBeUndefined()
    })
  })

  describe('getTemplates', () => {
    it('should fetch templates with pagination', async () => {
      const result = await client.getTemplates('TEST_PROJECT', { limit: 5, offset: 0 })

      expect(result).toMatchObject({
        count: 3,
        items: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.stringContaining('Automated Tests'),
            createdBy: expect.any(String),
            customFields: expect.objectContaining({
              templateFields: expect.arrayContaining([
                expect.objectContaining({
                  name: expect.any(String),
                  dataType: expect.any(String),
                }),
              ]),
            }),
            projectUid: expect.any(Number),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            deletedAt: null,
            isDefault: expect.any(Boolean),
            entityType: 'testCase',
            rules: expect.any(Array),
            externalId: null,
            source: null,
            integrationUid: null,
          }),
        ]),
        nextOffset: null, // All 3 templates are returned, so no more items
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getTemplates('TEST_PROJECT')

      expect(result).toMatchObject({
        count: 3,
        items: expect.any(Array),
        nextOffset: null, // Default limit is 10, so all 3 templates are returned
      })
    })

    it('should return null nextOffset when no more items', async () => {
      const result = await client.getTemplates('TEST_PROJECT', { limit: 10, offset: 0 })

      expect(result).toMatchObject({
        count: 3,
        items: expect.any(Array),
        nextOffset: null,
      })
    })

    it('should handle different template types correctly', async () => {
      const result = await client.getTemplates('TEST_PROJECT', { limit: 3, offset: 0 })

      expect(result.items).toHaveLength(3)
      expect(result.items[0].name).toBe('Automated Tests')
      expect(result.items[1].name).toBe('Simple')
      expect(result.items[2].name).toBe('Exploratory')
      expect(result.items[1].isDefault).toBe(true)
    })
  })

  describe('getTemplate', () => {
    it('should fetch a specific template by ID', async () => {
      const result = await client.getTemplate('TEST_PROJECT', 1)

      expect(result).toMatchObject({
        uid: 1,
        name: 'Automated Tests',
        createdBy: expect.any(String),
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'repository',
              dataType: 'text',
            }),
            expect.objectContaining({
              name: 'sha',
              dataType: 'text',
            }),
          ]),
        }),
        projectUid: 1,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        isDefault: false,
        entityType: 'testCase',
        rules: expect.any(Array),
        externalId: null,
        source: null,
        integrationUid: null,
      })
    })

    it('should fetch Simple template with correct fields', async () => {
      const result = await client.getTemplate('TEST_PROJECT', 2)

      expect(result).toMatchObject({
        uid: 2,
        name: 'Simple',
        isDefault: true,
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Pre-condition',
              dataType: 'text',
            }),
            expect.objectContaining({
              name: 'Steps',
              dataType: 'text',
            }),
            expect.objectContaining({
              name: 'Expected Result',
              dataType: 'text',
            }),
          ]),
        }),
      })
    })

    it('should fetch Exploratory template with correct fields', async () => {
      const result = await client.getTemplate('TEST_PROJECT', 3)

      expect(result).toMatchObject({
        uid: 3,
        name: 'Exploratory',
        isDefault: false,
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Title',
              dataType: 'text',
            }),
            expect.objectContaining({
              name: 'Charter',
              dataType: 'text',
            }),
            expect.objectContaining({
              name: 'Time Limit',
              dataType: 'text',
            }),
          ]),
        }),
      })
    })
  })

  describe('createTemplate', () => {
    it('should create a template successfully', async () => {
      const templateToCreate = {
        name: 'New Test Template',
        templateFields: [
          {
            name: 'Test Field 1',
            dataType: 'text',
          },
          {
            name: 'Test Field 2',
            dataType: 'number',
          },
        ],
      }

      const result = await client.createTemplate('TEST_PROJECT', templateToCreate)

      expect(result).toMatchObject({
        uid: 4,
        name: 'New Test Template',
        createdBy: expect.any(String),
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Test Field 1',
              dataType: 'text',
            }),
            expect.objectContaining({
              name: 'Test Field 2',
              dataType: 'number',
            }),
          ]),
        }),
        projectUid: 1,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        isDefault: false,
        entityType: 'testCase',
        rules: expect.any(Array),
        externalId: null,
        source: null,
        integrationUid: null,
      })
    })

    it('should create a template with minimal data', async () => {
      const templateToCreate = {
        name: 'Minimal Template',
      }

      const result = await client.createTemplate('TEST_PROJECT', templateToCreate)

      expect(result).toMatchObject({
        uid: 4,
        name: 'Minimal Template',
        createdBy: expect.any(String),
        customFields: expect.objectContaining({
          templateFields: [],
        }),
        projectUid: 1,
        isDefault: false,
        entityType: 'testCase',
      })
    })

    it('should handle template creation with empty templateFields', async () => {
      const templateToCreate = {
        name: 'Empty Fields Template',
        templateFields: [],
      }

      const result = await client.createTemplate('TEST_PROJECT', templateToCreate)

      expect(result).toMatchObject({
        uid: 4,
        name: 'Empty Fields Template',
        customFields: expect.objectContaining({
          templateFields: [],
        }),
      })
    })
  })

  describe('updateTemplate', () => {
    it('should update a template successfully', async () => {
      const updateData = {
        name: 'Updated Template Name',
        templateFields: [
          {
            name: 'Updated Field 1',
            dataType: 'text',
          },
          {
            name: 'Updated Field 2',
            dataType: 'boolean',
          },
        ],
      }

      const result = await client.updateTemplate('TEST_PROJECT', 1, updateData)

      expect(result).toMatchObject({
        uid: 1,
        name: 'Updated Template Name',
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Updated Field 1',
              dataType: 'text',
            }),
            expect.objectContaining({
              name: 'Updated Field 2',
              dataType: 'boolean',
            }),
          ]),
        }),
        updatedAt: expect.any(String),
      })
    })

    it('should update only template name', async () => {
      const updateData = {
        name: 'Only Name Updated',
      }

      const result = await client.updateTemplate('TEST_PROJECT', 1, updateData)

      expect(result).toMatchObject({
        uid: 1,
        name: 'Only Name Updated',
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'repository',
              dataType: 'text',
            }),
          ]),
        }),
        updatedAt: expect.any(String),
      })
    })

    it('should update only template fields', async () => {
      const updateData = {
        templateFields: [
          {
            name: 'New Field Only',
            dataType: 'text',
          },
        ],
      }

      const result = await client.updateTemplate('TEST_PROJECT', 1, updateData)

      expect(result).toMatchObject({
        uid: 1,
        name: 'Automated Tests', // Original name preserved
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'New Field Only',
              dataType: 'text',
            }),
          ]),
        }),
        updatedAt: expect.any(String),
      })
    })

    it('should handle partial updates correctly', async () => {
      const updateData = {
        name: 'Partially Updated',
      }

      const result = await client.updateTemplate('TEST_PROJECT', 2, updateData)

      expect(result).toMatchObject({
        uid: 2,
        name: 'Partially Updated',
        customFields: expect.objectContaining({
          templateFields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Pre-condition',
              dataType: 'text',
            }),
          ]),
        }),
        updatedAt: expect.any(String),
      })
    })
  })

  describe('deleteTemplate', () => {
    it('should delete a template successfully', async () => {
      const result = await client.deleteTemplate('TEST_PROJECT', 1)

      expect(result).toBeUndefined()
    })

    it('should handle deletion of different template IDs', async () => {
      await expect(client.deleteTemplate('TEST_PROJECT', 2)).resolves.toBeUndefined()
      await expect(client.deleteTemplate('TEST_PROJECT', 3)).resolves.toBeUndefined()
    })

    it('should handle deletion of non-existent template', async () => {
      await expect(client.deleteTemplate('TEST_PROJECT', 999)).resolves.toBeUndefined()
    })
  })
})
