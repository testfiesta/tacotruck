import type { AuthOptions } from '../network'
import ky from 'ky'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processGetRequest } from '../network'

vi.mock('ky', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('network utils with AuthOptions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('processGetRequest with AuthOptions', () => {
    it('should make a GET request and process the response', async () => {
      // Setup
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

    it('should handle null authOptions properly', async () => {
      // Setup
      const mockResponseData = { items: [1, 2, 3] }
      const mockJsonPromise = Promise.resolve(mockResponseData)
      const mockResponse = { json: () => mockJsonPromise } as any
      vi.mocked(ky.get).mockResolvedValue(mockResponse)

      const authOptions = null

      const result = await processGetRequest(authOptions, 'https://example.com/api', {}, 'projects')

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.unwrap()).toEqual({
          data: mockResponseData,
          source_type: 'projects',
          target_type: 'unknown',
        })
      }

      expect(ky.get).toHaveBeenCalledWith('https://example.com/api', {})
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
})
