import type { ETLConfig } from './etl-types'
import pLimit from 'p-limit'
import PQueue from 'p-queue'
import * as dataUtils from './data'

/**
 * Utility function for functional composition
 * @param value The initial value to pass through the function pipeline
 * @param fns The functions to compose and apply sequentially
 * @returns The result after applying all functions in sequence
 */
export function pipe<T>(value: T, ...fns: Array<(arg: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value)
}

export interface ResponseData {
  data: any
  source_type: string
  target_type: string
}

/**
 * Process response data and map it according to configuration
 * @param response The response data to process
 * @param config The endpoint configuration
 * @param data The data container to add processed data to
 */
export function processResponseData(
  response: ResponseData,
  config: ETLConfig,
  data: Record<string, any[]>,
): void {
  if (!response || typeof response !== 'object') {
    return
  }

  pipe(
    Array.isArray(response.data) && response.data.length > 0
      ? response.data
      : Array.isArray(response.data)
        ? []
        : [response.data],

    (records: any[]) => records.length > 0 ? records : [],

    (records: any[]) => {
      for (const record of records) {
        const typedRecord = record as Record<string, any>

        const dataPoint = dataUtils.mapDataWithIgnores(
          config.typeConfig?.source?.[response.source_type]?.mapping || {},
          typedRecord,
          config.ignoreConfig?.[response.source_type] || {},
        )

        if (dataPoint) {
          if (!data[response.target_type]) {
            data[response.target_type] = []
          }
          data[response.target_type].push(dataPoint)
        }
      }
    },
  )
}

/**
 * Process data in batches with concurrency control using p-queue
 * @template T The type of items to process
 * @template R The type of results returned
 * @param items Items to process
 * @param batchSize Size of each batch
 * @param processFn Function to process each batch
 * @param concurrency Maximum number of concurrent batch operations (default: 1)
 * @returns Promise resolving to an array of processed results
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processFn: (batch: T[]) => Promise<R[]>,
  concurrency = 1,
): Promise<R[]> {
  const results: R[] = []
  const queue = new PQueue({ concurrency })

  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  const promises = batches.map((batch) => {
    return queue.add(async () => {
      const batchResults = await processFn(batch)
      results.push(...batchResults)
      return batchResults
    })
  })

  await Promise.all(promises)

  return results
}

/**
 * Process data in batches with concurrency control using p-limit
 * @template T The type of items to process
 * @template R The type of results returned
 * @param items Items to process
 * @param batchSize Size of each batch
 * @param processFn Function to process each batch
 * @param concurrency Maximum number of concurrent batch operations (default: 1)
 * @returns Promise resolving to an array of processed results
 */
export async function processBatchesWithLimit<T, R>(
  items: T[],
  batchSize: number,
  processFn: (batch: T[]) => Promise<R[]>,
  concurrency = 1,
): Promise<R[]> {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  const limit = pLimit(concurrency)

  const batchResults = await Promise.all(
    batches.map(batch => limit(() => processFn(batch))),
  )

  return batchResults.flat()
}

/**
 * Type for data point with source control information
 */
export interface DataPointWithSourceControl {
  source_control?: Record<string, any>
  [key: string]: any
}

/**
 * Apply source control information to data
 * @param data The data to process
 * @param config The endpoint configuration
 * @returns The data with source control information applied
 */
export function applySourceControlInfo(
  data: Record<string, DataPointWithSourceControl[]>,
  config: ETLConfig,
): Record<string, DataPointWithSourceControl[]> {
  const transformedData = { ...data }

  for (const [_dataType, dataPoints] of Object.entries(transformedData)) {
    if (Array.isArray(dataPoints)) {
      for (const dataPoint of dataPoints) {
        if (config.typeConfig?.source_control) {
          dataPoint.source_control = { ...config.typeConfig.source_control }
        }
      }
    }
  }

  return transformedData
}
