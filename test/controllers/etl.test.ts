import type { ETLConfig } from '../../src/utils/etl-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadData } from '../../src/controllers/etl'
import * as batchProcessor from '../../src/utils/batch-processor'
import * as dataUtils from '../../src/utils/data'

// Mock dependencies
vi.mock('../../src/utils/batch-processor', () => ({
  processBatches: vi.fn().mockResolvedValue(undefined),
  processResponseData: vi.fn(),
  applySourceControlInfo: vi.fn(data => data),
}))

vi.mock('../../src/services/api-client', () => ({
  apiClient: {
    processPostRequest: vi.fn().mockResolvedValue({ status: 200, data: { success: true } }),
    processGetRequest: vi.fn().mockResolvedValue(null),
    buildUrl: vi.fn().mockReturnValue('https://api.example.com/test'),
    buildUrls: vi.fn().mockReturnValue(['https://api.example.com/test']),
  },
}))

// Setup typed mocks
const mockedBatchProcessor = vi.mocked(batchProcessor)

vi.mock('../../src/utils/data', () => ({
  buildRequestData: vi.fn((dataKey, _, data) => {
    return dataKey ? { [dataKey]: data } : data
  }),
}))

describe('eTL Controller - loadData', () => {
  // Test configuration
  const mockConfig: ETLConfig = {
    name: 'test-config',
    integration: 'test-integration',
    throttleCap: 10,
    ignoreConfig: false,
    source_control: {} as unknown as Record<string, Record<string, any>>,
    offsets: {},
    baseUrl: 'https://api.example.com',
    endpointSet: ['users', 'products'],
    typeConfig: {
      name: 'test-source',
      type: 'test-type',
      base_path: '/api/v1',
      target: {
        users: {
          endpoints: {
            update: {
              path: '/users/{id}',
              data_key: 'user',
              update_key: 'id',
              required_keys: ['id', 'name'],
            },
            create: {
              single_path: '/users',
              bulk_path: '/users/bulk',
              data_key: 'users',
            },
          },
        },
        products: {
          endpoints: {
            update: {
              path: '/products/{id}',
              data_key: 'product',
              update_key: 'id',
            },
            create: {
              single_path: '/products',
              bulk_path: '/products/bulk',
              data_key: 'products',
              payload_key: 'file_path',
            },
          },
        },
      },
    },
  }

  const mockData = {
    source: 'test-source',
    users: [
      { id: 1, name: 'User 1', email: 'user1@example.com' },
      { id: 2, name: 'User 2', email: 'user2@example.com' },
      { name: 'New User', email: 'newuser@example.com' },
    ],
    products: [
      { id: 101, name: 'Product 1', price: 19.99 },
      { name: 'New Product', price: 29.99 },
    ],
    invalid_endpoint: [
      { id: 999, name: 'Invalid' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should validate data against configuration', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await loadData(mockConfig, mockData)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Data found for [invalid_endpoint]'),
    )

    consoleErrorSpy.mockRestore()
  })

  it('should process update requests correctly', async () => {
    await loadData(mockConfig, mockData)

    expect(batchProcessor.processBatches).toHaveBeenCalledTimes(1)

    const requestPromises = mockedBatchProcessor.processBatches.mock.calls[0][0]

    const updateRequests = requestPromises.filter((req: { url: string, options: any }) =>
      (req.url.includes('/users/1') || req.url.includes('/users/2')) && req.options.data,
    )

    expect(updateRequests.length).toBe(2)
    expect(updateRequests[0].url).toContain('/users/1')
    expect(updateRequests[1].url).toContain('/users/2')
  })

  it('should handle bulk data creation correctly', async () => {
    const configWithoutMultiTarget = { ...mockConfig }

    await loadData(configWithoutMultiTarget, mockData)

    expect(batchProcessor.processBatches).toHaveBeenCalledTimes(1)

    const requestPromises = mockedBatchProcessor.processBatches.mock.calls[0][0]

    const bulkRequests = requestPromises.filter((req: { url: string }) =>
      req.url.includes('/bulk'),
    )

    expect(bulkRequests.length).toBeGreaterThan(0)

    expect(dataUtils.buildRequestData).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.any(Array),
    )
  })

  it('should handle multi-target bulk data correctly', async () => {
    const configWithMultiTarget: ETLConfig = {
      ...mockConfig,
      typeConfig: {
        name: 'test-source',
        type: 'test-type',
        base_path: '/api/v1',
        target: { ...mockConfig.typeConfig?.target },
        multi_target: {
          path: '/batch',
          data_key: 'items',
          include_source: true,
        },
      },
    }

    await loadData(configWithMultiTarget, mockData)

    expect(batchProcessor.processBatches).toHaveBeenCalledTimes(1)

    const requestPromises = mockedBatchProcessor.processBatches.mock.calls[0][0]

    const multiTargetRequest = requestPromises.find((req: { url: string }) =>
      req.url.includes('/batch'),
    )

    expect(multiTargetRequest).toBeDefined()

    expect(multiTargetRequest?.url).toBe('https://api.example.com/api/v1/batch')
  })

  it('should handle empty data gracefully', async () => {
    await loadData(mockConfig, { source: 'test-source' })

    expect(batchProcessor.processBatches).not.toHaveBeenCalled()
  })
})
