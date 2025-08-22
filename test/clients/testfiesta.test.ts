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
        data: expect.arrayContaining([
          expect.objectContaining({
            uid: expect.any(Number),
            name: expect.stringContaining('Test Project'),
            key: expect.stringContaining('TEST_PROJECT'),
          }),
        ]),
        pagination: {
          limit: 5,
          offset: 0,
          total: 25,
          hasMore: true,
        },
      })
    })

    it('should use default pagination when no options provided', async () => {
      const result = await client.getProjects()

      expect(result).toMatchObject({
        pagination: {
          limit: 10,
          offset: 0,
        },
      })
    })
  })
})
