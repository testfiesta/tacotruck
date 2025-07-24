import type { AuthOptions } from '../network'
import ky from 'ky'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAuthenticatedOptions,
  createQueue,
  processBatchedRequests,
  processGetRequest,
  processPostRequest,
} from '../network'
import { err, ok } from '../result'

vi.mock('ky', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

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
          Authorization: 'Bearer token123',
        },
      })
    })

    it('should create options with auth query param', () => {
      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'query',
      }

      const result = createAuthenticatedOptions(authOptions)

      expect(result).toEqual({})
    })

    it('should return empty options if auth options is null', () => {
      const authOptions = null

      const result = createAuthenticatedOptions(authOptions)

      expect(result).toEqual({})
    })
  })

  describe('processPostRequest', () => {
    it('should make a POST request and process the response', async () => {
      // Setup
      const mockResponseData = { id: 123, status: 'success' }
      const mockJsonPromise = Promise.resolve(mockResponseData)
      const mockResponse = {
        json: () => mockJsonPromise,
        ok: true,
      } as any
      vi.mocked(ky.post).mockResolvedValue(mockResponse)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const options = {
        data: { foo: 'bar' },
        timeout: 5000,
      }

      const result = await processPostRequest(authOptions, 'https://example.com/api', options)

      expect(result.isOk).toBe(true)
      expect(result.unwrap()).toBe(mockResponse)
      expect(ky.post).toHaveBeenCalledWith('https://example.com/api', {
        headers: {
          Authorization: 'Bearer token123',
        },
        json: { foo: 'bar' },
        timeout: 5000,
      })
    })

    it('should return error result when request fails', async () => {
      vi.mocked(ky.post).mockRejectedValue(new Error('Network error'))

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const result = await processPostRequest(authOptions, 'https://example.com/api')

      expect(result.isErr).toBe(true)
      expect(() => result.unwrap()).toThrow('Network error')
    })
  })

  describe('processGetRequest', () => {
    it('should make a GET request and process the response', async () => {
      const mockResponseData = { items: [1, 2, 3] }
      const mockJsonPromise = Promise.resolve(mockResponseData)
      const mockResponse = { json: () => mockJsonPromise } as any
      vi.mocked(ky.get).mockResolvedValue(mockResponse)

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const result = await processGetRequest(authOptions, 'https://example.com/api', {}, 'projects')

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.unwrap()).toEqual({
          data: mockResponseData,
          source_type: 'projects',
          target_type: 'unknown',
        })
      }

      expect(ky.get).toHaveBeenCalledWith('https://example.com/api', {
        headers: {
          Authorization: 'Bearer token123',
        },
      })
    })

    it('should handle errors properly', async () => {
      vi.mocked(ky.get).mockRejectedValue(new Error('Network error'))

      const authOptions: AuthOptions = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer token123',
      }

      const result = await processGetRequest(authOptions, 'https://example.com/api', {}, 'projects')

      expect(result.isOk).toBe(false)
      if (!result.isOk) {
        const error = result as unknown as { error: Error }
        expect(error.error.message).toBe('Network error')
      }
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
        () => Promise.resolve(ok('result1')),
        () => Promise.resolve(ok('result2')),
        () => Promise.resolve(ok('result3')),
      ]

      const result = await processBatchedRequests(mockRequests, 2, 5, 500)

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.unwrap()).toEqual(['result1', 'result2', 'result3'])
      }

      consoleWarnMock.mockRestore()
    })

    it('should return error when any request fails', async () => {
      const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockError = new Error('Request failed')
      const mockRequests = [
        () => Promise.resolve(ok('result1')),
        () => Promise.resolve(err(mockError)),
        () => Promise.resolve(ok('result3')),
      ]

      const result = await processBatchedRequests(mockRequests, 2, 5, 500)

      expect(result.isErr).toBe(true)
      expect(() => result.unwrap()).toThrow('Request failed')

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

      const result = await processBatchedRequests(mockRequests, 2, 5, 500)

      expect(result.isErr).toBe(true)
      expect(() => result.unwrap()).toThrow('Batch processing error')

      consoleWarnMock.mockRestore()
      consoleErrorMock.mockRestore()
    })
  })
})
