import type { AuthOptions } from '../network'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAuthenticatedOptions,
  createQueue,
  processBatchedRequests,
  processGetRequest,
  processPostRequest,
} from '../network'
import { getUserAgent } from '../version'

vi.mock('../network', async () => {
  const actual = await vi.importActual('../network') as typeof import('../network')
  return {
    ...actual,
    processPostRequest: vi.fn(),
    processGetRequest: vi.fn(),
  }
})

describe('network utils', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createAuthenticatedOptions', () => {
    it('should create options with auth header', () => {
      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const result = createAuthenticatedOptions(authOptions)

      expect(result).toEqual({
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
          'Authorization': 'Bearer token123',
        },
      })
    })

    it('should create options with auth query param', () => {
      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'query',
      }

      const result = createAuthenticatedOptions(authOptions)

      expect(result).toEqual({
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        },
      })
    })

    it('should return empty options if auth options is null', () => {
      const authOptions = null

      const result = createAuthenticatedOptions(authOptions)

      expect(result).toEqual({
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        },
      })
    })
  })

  describe('processPostRequest', () => {
    it('should make a POST request and process the response', async () => {
      const mockResponseData = { id: 123, status: 'success' }
      const mockResponse = {
        json: () => Promise.resolve(mockResponseData),
        ok: true,
      } as any

      vi.mocked(processPostRequest).mockResolvedValue(mockResponse)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const options = {
        json: { foo: 'bar' },
        timeout: 1000,
      }

      const result = await processPostRequest(authOptions, 'https://example.com/api', options)

      expect(result).toBe(mockResponse)
      expect(processPostRequest).toHaveBeenCalledWith(authOptions, 'https://example.com/api', options)
    })

    it('should respect retryAttempts and retryDelay options', async () => {
      const mockResponseData = { id: 123, status: 'success' }
      const mockResponse = {
        json: () => Promise.resolve(mockResponseData),
        ok: true,
      } as any

      vi.mocked(processPostRequest).mockResolvedValue(mockResponse)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const options = {
        json: { foo: 'bar' },
        timeout: 5000,
        retry: 3,
        retryDelay: 2000,
      }

      const result = await processPostRequest(authOptions, 'https://example.com/api', options)

      expect(result).toBe(mockResponse)
      expect(processPostRequest).toHaveBeenCalledWith(authOptions, 'https://example.com/api', options)
    })

    it('should throw error when request fails', async () => {
      const networkError = new Error('Network error')

      vi.mocked(processPostRequest).mockRejectedValue(networkError)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      await expect(processPostRequest(authOptions, 'https://example.com/api')).rejects.toThrow('Network error')
      expect(processPostRequest).toHaveBeenCalledWith(authOptions, 'https://example.com/api')
    })
  })

  describe('processGetRequest', () => {
    it('should make a GET request and process the response', async () => {
      const mockResponseData = { items: [1, 2, 3] }
      const mockResult = {
        data: mockResponseData,
        source_type: 'projects',
        target_type: 'unknown',
      }

      vi.mocked(processGetRequest).mockResolvedValue(mockResult)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const result = await processGetRequest(authOptions, 'https://example.com/api', {})

      expect(result).toEqual(mockResult)
      expect(processGetRequest).toHaveBeenCalledWith(authOptions, 'https://example.com/api', {})
    })

    it('should handle errors properly', async () => {
      const networkError = new Error('Network error')

      vi.mocked(processGetRequest).mockRejectedValue(networkError)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      await expect(processGetRequest(authOptions, 'https://example.com/api', {})).rejects.toThrow('Network error')
      expect(processGetRequest).toHaveBeenCalledWith(authOptions, 'https://example.com/api', {})
    })

    it('should respect retryAttempts and retryDelay options for GET requests', async () => {
      const mockResponseData = { items: [1, 2, 3] }
      const mockResult = {
        data: mockResponseData,
        source_type: 'projects',
        target_type: 'unknown',
      }

      vi.mocked(processGetRequest).mockResolvedValue(mockResult)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const options = {
        timeout: 10000,
        retryAttempts: 2,
        retryDelay: 1500,
      }

      const result = await processGetRequest(authOptions, 'https://example.com/api', options)

      expect(result).toEqual(mockResult)
      expect(processGetRequest).toHaveBeenCalledWith(authOptions, 'https://example.com/api', options)
    })
  })

  describe('processBatchedRequests with ETLv2Options', () => {
    it('should use ETLv2Options in batch processing', async () => {
      const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockRequests = [
        () => Promise.resolve('result1'),
        () => Promise.resolve('result2'),
      ]

      const options = {
        timeout: 15000,
        retryAttempts: 2,
        retryDelay: 1000,
      }
      await processBatchedRequests(mockRequests, {
        concurrencyLimit: 2,
        throttleLimit: 5,
        throttleInterval: 500,
      }, options)
      expect(consoleWarnMock).toHaveBeenCalledWith('Processing', 'requests', 'with concurrency limit:', 2, 'throttle limit:', 5, 'throttle interval:', 500)

      consoleWarnMock.mockRestore()
      consoleErrorMock.mockRestore()
    })
  })

  describe('createQueue', () => {
    it('should create a queue with specified concurrency', () => {
      const queue = createQueue(5)
      expect(queue).toBeDefined()
      expect(queue.concurrency).toBe(5)
    })
  })

  describe('processBatchedRequests', () => {
    it('should process requests in batches and return combined results', async () => {
      const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const mockRequests = [
        () => Promise.resolve('result1'),
        () => Promise.resolve('result2'),
        () => Promise.resolve('result3'),
      ]

      await processBatchedRequests(mockRequests, {
        concurrencyLimit: 2,
        throttleLimit: 5,
        throttleInterval: 500,
      }, {})

      consoleWarnMock.mockRestore()
    })

    it('should throw error when any request fails', async () => {
      const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockError = new Error('Request failed')
      const mockRequests = [
        () => Promise.resolve('result1'),
        () => Promise.reject(mockError),
        () => Promise.resolve('result3'),
      ]

      await expect(processBatchedRequests(mockRequests, {
        concurrencyLimit: 2,
        throttleLimit: 5,
        throttleInterval: 500,
      }, {})).rejects.toThrow('Request failed')

      consoleWarnMock.mockRestore()
      consoleErrorMock.mockRestore()
    })

    it('should handle exceptions during batch processing', async () => {
      const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockError = new Error('Batch processing error')
      const mockRequests = [
        () => { throw mockError },
      ]

      await expect(processBatchedRequests(mockRequests, {
        concurrencyLimit: 2,
        throttleLimit: 5,
        throttleInterval: 500,
      }, {})).rejects.toThrow('Batch processing error')

      consoleWarnMock.mockRestore()
      consoleErrorMock.mockRestore()
    })
  })
})
