import type { ETLConfig } from '../etl-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applySourceControlInfo, pipe, processBatches, processBatchesWithLimit, processResponseData } from '../batch-processor'
import * as dataUtils from '../data'

vi.mock('../data', () => ({
  mapDataWithIgnores: vi.fn(),
}))

describe('batch-processor', () => {
  const defaultETLConfig: ETLConfig = {
    name: 'test-config',
    type: 'api',
    direction: 'extract',
    integration: 'test-integration',
    throttleCap: 10,
    endpointSet: ['projects'],
    offsets: {},
    typeConfig: {
      name: 'test-config',
      type: 'api',
      source: {
        projects: {
          mapping: { id: 'project_id', name: 'project_name' },
        },
      },
    },
  }

  describe('pipe', () => {
    it('should apply functions in sequence', () => {
      const add2 = (x: number) => x + 2
      const multiply3 = (x: number) => x * 3
      const toString = (x: number) => `Result: ${x}`

      const result = pipe(5, add2, multiply3, toString)

      expect(result).toBe('Result: 21')
    })

    it('should return the original value when no functions are provided', () => {
      const result = pipe(5)

      expect(result).toBe(5)
    })
  })

  describe('processResponseData', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('should process array response data', () => {
      const response = {
        data: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
        source_type: 'projects',
        target_type: 'projects',
      }

      const config: ETLConfig = {
        ...defaultETLConfig,
        typeConfig: {
          name: 'test-config',
          type: 'api',
          source: {
            projects: {
              mapping: { id: 'project_id', name: 'project_name' },
            },
          },
        },
      }

      const data: Record<string, any[]> = {}

      vi.mocked(dataUtils.mapDataWithIgnores).mockImplementation((mapping, data) => {
        return { project_id: data.id, project_name: data.name }
      })

      processResponseData(response, config, data)

      expect(dataUtils.mapDataWithIgnores).toHaveBeenCalledTimes(2)
      expect(data).toEqual({
        projects: [
          { project_id: 1, project_name: 'Item 1' },
          { project_id: 2, project_name: 'Item 2' },
        ],
      })
    })

    it('should process single object response data', () => {
      const response = {
        data: { id: 1, name: 'Item 1' },
        source_type: 'projects',
        target_type: 'projects',
      }

      const config: ETLConfig = {
        ...defaultETLConfig,
        typeConfig: {
          name: 'test-config',
          type: 'api',
          source: {
            projects: {
              mapping: { id: 'project_id', name: 'project_name' },
            },
          },
        },
      }

      const data: Record<string, any[]> = {}

      vi.mocked(dataUtils.mapDataWithIgnores).mockImplementation((mapping, data) => {
        return { project_id: data.id, project_name: data.name }
      })

      processResponseData(response, config, data)

      expect(dataUtils.mapDataWithIgnores).toHaveBeenCalledTimes(1)
      expect(data).toEqual({
        projects: [
          { project_id: 1, project_name: 'Item 1' },
        ],
      })
    })

    it('should handle empty array response data', () => {
      const response = {
        data: [],
        source_type: 'projects',
        target_type: 'projects',
      }

      const config: ETLConfig = {
        ...defaultETLConfig,
        typeConfig: {
          name: 'test-config',
          type: 'api',
          source: {
            projects: {
              mapping: { id: 'project_id', name: 'project_name' },
            },
          },
        },
      }

      const data: Record<string, any[]> = {}

      processResponseData(response, config, data)

      expect(dataUtils.mapDataWithIgnores).not.toHaveBeenCalled()
      expect(data).toEqual({})
    })

    it('should skip records that should be ignored', () => {
      const response = {
        data: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
        source_type: 'projects',
        target_type: 'projects',
      }

      const config: ETLConfig = {
        ...defaultETLConfig,
        typeConfig: {
          name: 'test-config',
          type: 'api',
          source: {
            projects: {
              mapping: { id: 'project_id', name: 'project_name' },
            },
          },
        },
        ignoreConfig: {
          projects: {
            id: ['2'],
          },
        },
      }

      const data: Record<string, any[]> = {}

      vi.mocked(dataUtils.mapDataWithIgnores).mockImplementationOnce((mapping, data) => {
        return { project_id: data.id, project_name: data.name }
      }).mockImplementationOnce(() => false)

      processResponseData(response, config, data)

      expect(dataUtils.mapDataWithIgnores).toHaveBeenCalledTimes(2)
      expect(data).toEqual({
        projects: [
          { project_id: 1, project_name: 'Item 1' },
        ],
      })
    })

    it('should do nothing for invalid response data', () => {
      const response = null as any
      const config: ETLConfig = { ...defaultETLConfig }
      const data: Record<string, any[]> = {}

      processResponseData(response, config, data)

      expect(dataUtils.mapDataWithIgnores).not.toHaveBeenCalled()
      expect(data).toEqual({})
    })
  })

  describe('processBatches', () => {
    it('should process items in batches with concurrency control', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7]
      const batchSize = 3
      const processFn = vi.fn().mockImplementation(async (batch: number[]) => {
        return batch.map(item => item * 2)
      })

      const result = await processBatches(items, batchSize, processFn, 2)

      expect(processFn).toHaveBeenCalledTimes(3)
      expect(processFn).toHaveBeenNthCalledWith(1, [1, 2, 3])
      expect(processFn).toHaveBeenNthCalledWith(2, [4, 5, 6])
      expect(processFn).toHaveBeenNthCalledWith(3, [7])
      expect(result).toEqual([2, 4, 6, 8, 10, 12, 14])
    })
  })

  describe('processBatchesWithLimit', () => {
    it('should process items in batches with concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7]
      const batchSize = 3
      const processFn = vi.fn().mockImplementation(async (batch: number[]) => {
        return batch.map(item => item * 2)
      })

      const result = await processBatchesWithLimit(items, batchSize, processFn, 2)

      expect(processFn).toHaveBeenCalledTimes(3)
      expect(processFn).toHaveBeenNthCalledWith(1, [1, 2, 3])
      expect(processFn).toHaveBeenNthCalledWith(2, [4, 5, 6])
      expect(processFn).toHaveBeenNthCalledWith(3, [7])
      expect(result).toEqual([2, 4, 6, 8, 10, 12, 14])
    })
  })

  describe('applySourceControlInfo', () => {
    it('should apply source control info to all data points', () => {
      const data = {
        projects: [
          { id: 1, name: 'Project 1' },
          { id: 2, name: 'Project 2' },
        ],
        tasks: [
          { id: 101, name: 'Task 1' },
        ],
      }

      const config: ETLConfig = {
        ...defaultETLConfig,
        typeConfig: {
          name: 'test-config',
          type: 'api',
          source_control: {
            source: 'git',
            version: '1.0.0',
          },
        },
      }

      const result = applySourceControlInfo(data, config)

      expect(result).toEqual({
        projects: [
          { id: 1, name: 'Project 1', source_control: { source: 'git', version: '1.0.0' } },
          { id: 2, name: 'Project 2', source_control: { source: 'git', version: '1.0.0' } },
        ],
        tasks: [
          { id: 101, name: 'Task 1', source_control: { source: 'git', version: '1.0.0' } },
        ],
      })
    })

    it('should not modify data when no source control info is provided', () => {
      const data = {
        projects: [
          { id: 1, name: 'Project 1' },
          { id: 2, name: 'Project 2' },
        ],
      }

      const config: ETLConfig = { ...defaultETLConfig }

      const result = applySourceControlInfo(data, config)

      expect(result).toEqual({
        projects: [
          { id: 1, name: 'Project 1' },
          { id: 2, name: 'Project 2' },
        ],
      })
    })
  })
})
