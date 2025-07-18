import type { ConfigType } from './config-schema'
import type { Err, Result } from './result'

import ky from 'ky'
import PQueue from 'p-queue'
import pThrottle from 'p-throttle'
import { processBatchesWithLimit } from './batch-processor'
import { err, ok } from './result'

export interface GetResponseData {
  data: any
  source_type: string
  target_type: string
}

export interface RequestOptions {
  headers?: Record<string, string>
  json?: any
  searchParams?: Record<string, string>
  timeout?: number
  [key: string]: any
}

/**
 * Create request options with authentication headers
 * @param config The endpoint configuration
 * @returns Request options with authentication headers
 */
export function createAuthenticatedOptions(
  config: ConfigType,
): RequestOptions {
  const options: RequestOptions = {}

  if (config.auth?.location === 'header') {
    options.headers = {}
    if (config.auth.key && config.auth.payload) {
      options.headers[config.auth.key] = config.auth.payload
    }
  }

  return options
}

/**
 * Process a POST request with authentication headers
 * @param config The endpoint configuration
 * @param url The URL to request
 * @param options Additional request options
 * @returns Promise with Result containing response data or error
 */
export async function processPostRequest(
  config: ConfigType,
  url: string,
  options: RequestOptions = {},
): Promise<Result<any, Error>> {
  try {
    const authOptions = createAuthenticatedOptions(config)
    const mergedOptions = { ...authOptions, ...options }

    const jsonData = options.data
    if (jsonData) {
      mergedOptions.json = jsonData
      delete mergedOptions.data
    }

    const response = await ky.post(url, mergedOptions)

    return ok(response)
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

export async function processGetRequest(
  config: ConfigType,
  url: string,
  options: RequestOptions = {},
  sourceType: string,
): Promise<Result<GetResponseData, Error>> {
  const opts = { ...options }
  if (config.auth?.location === 'header') {
    opts.headers = opts.headers || {}
    if (config.auth.key && config.auth.payload) {
      opts.headers[config.auth.key] = config.auth.payload
    }
  }

  try {
    const response = await ky.get(url, opts)
    const data = await response.json()
    return ok({
      data,
      source_type: sourceType,
      target_type: config.typeConfig?.source?.[sourceType]?.target_type || sourceType,
    })
  }
  catch (error) {
    console.error(`Error fetching from ${url}:`, error)
    return err(error instanceof Error ? error : new Error(`Error fetching from ${url}: ${String(error)}`))
  }
}

/**
 * Create a queue with concurrency control
 * @param defaultConcurrency Default concurrency if not specified in config
 * @returns A PQueue instance
 */
export function createQueue(defaultConcurrency: number): PQueue {
  return new PQueue({ concurrency: defaultConcurrency })
}

export async function processBatchedRequests<R, E>(
  requests: Array<() => Promise<Result<R, E>>>,
  concurrencyLimit = 10,
  throttleLimit = 10,
  throttleInterval = 1000,
): Promise<Result<R[], E>> {
  try {
    console.warn(`Processing ${requests.length} requests with concurrency ${concurrencyLimit}`)
    console.warn(`Throttling to ${throttleLimit} requests per ${throttleInterval}ms`)

    const throttle = pThrottle({
      limit: throttleLimit,
      interval: throttleInterval,
    })

    const throttledRequests = requests.map(req => throttle(() => req()))

    const batchSize = 10

    const batchResults = await processBatchesWithLimit(
      throttledRequests,
      batchSize,
      async (batch) => {
        const results = await Promise.all(batch.map(req => req()))
        console.warn(`Completed batch of ${batch.length} requests`)
        return results
      },
      concurrencyLimit,
    )

    const results: R[] = []
    const errors: E[] = []

    for (const result of batchResults.flat()) {
      if (result.isOk) {
        results.push(result.unwrap() as R)
      }
      else {
        errors.push((result as Err<R, E>).error)
      }
    }

    if (errors.length > 0) {
      console.error(`${errors.length} requests failed out of ${batchResults.length}`)
      return err(errors[0])
    }

    console.warn(`Completed ${results.length} requests with concurrency ${concurrencyLimit}`)
    return ok(results)
  }
  catch (error) {
    console.error('Batch processing failed:', error)
    return err(error instanceof Error ? error as E : new Error(String(error)) as E)
  }
}
