import type { Options } from 'ky'
import type { Err, Result } from './result'
import ky from 'ky'
import PQueue from 'p-queue'

import pThrottle from 'p-throttle'
import { processBatchesWithLimit } from './batch-processor'
import { err, ok } from './result'

/**
 * Authentication options interface
 */
export interface AuthOptions {
  type: string
  location: 'header' | 'query' | 'body'
  key?: string
  payload?: string
}

export interface RequestOptions extends Options {
  data?: Record<string, unknown>
}

/**
 * Create request options with authentication headers
 * @param authOptions The authentication options
 * @returns Request options with authentication headers
 */
export function createAuthenticatedOptions(
  authOptions: AuthOptions | null,
): Options {
  const options: Options = {}

  if (!authOptions) {
    return options
  }

  if (authOptions.location === 'header') {
    options.headers = {}
    if (authOptions.key && authOptions.payload) {
      options.headers[authOptions.key] = authOptions.payload
    }
    else {
      console.warn('Auth header not added:', {
        hasKey: !!authOptions.key,
        hasPayload: !!authOptions.payload,
        key: authOptions.key,
        payloadPrefix: authOptions.payload?.substring(0, 10),
      })
    }
  }

  return options
}

/**
 * Process a POST request with authentication headers
 * @param authOptions Authentication options
 * @param url The URL to request
 * @param options Additional request options
 * @returns Promise with Result containing response data or error
 */
export async function processPostRequest(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
): Promise<Result<any, Error>> {
  try {
    const authRequestOptions = createAuthenticatedOptions(authOptions)
    const mergedOptions = { ...authRequestOptions, ...options }

    const jsonData = options.data
    if (jsonData) {
      mergedOptions.json = jsonData
      delete mergedOptions.data
    }

    const response = await ky.post(url, {
      retry: 0,
      timeout: 1000,
      ...mergedOptions,
    })

    if (!response.ok) {
      return err(new Error('Post request failed'))
    }

    return ok(response)
  }
  catch (error: any) {
    console.error('API Request Failed:', error.message)
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

export interface GetResponseData {
  data: any
  source_type: string
  target_type: string
}

export async function processGetRequest(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
  sourceType: string,
): Promise<Result<GetResponseData, Error>> {
  const authRequestOptions = createAuthenticatedOptions(authOptions)
  const opts = { ...authRequestOptions, ...options }

  try {
    const response = await ky.get(url, opts)
    const data = await response.json()
    return ok({
      data,
      source_type: sourceType,
      target_type: 'unknown',
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
      async (batch: Array<() => Promise<Result<R, E>>>) => {
        const results = await Promise.all(batch.map((req: () => Promise<Result<R, E>>) => req()))
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
