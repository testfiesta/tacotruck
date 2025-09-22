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
})
