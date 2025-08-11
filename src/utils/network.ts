import type { FetchOptions } from 'ofetch'
import type { Err, Result } from './result'
import { ofetch } from 'ofetch'
import PQueue from 'p-queue'
import pThrottle from 'p-throttle'
import { processBatchesWithLimit } from './batch-processor'
import { createProgressBar, stopProgressBar, updateProgressBar } from './progress-bar'
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

/**
 * Extended request options that include ETLv2Options parameters
 */
export interface RequestOptions extends FetchOptions {
  retryDelay?: number
  json?: Record<string, any>
  headers?: Record<string, any>
  showProgress?: boolean
  progressLabel?: string
}

/**
 * Create request options with authentication headers
 * @param authOptions The authentication options
 * @returns Request options with authentication headers
 */
export function createAuthenticatedOptions(
  authOptions: AuthOptions | null,
): Record<string, any> {
  const options = { headers: {} }

  if (!authOptions) {
    return options
  }

  if (authOptions.location === 'header') {
    options.headers = {}
    if (authOptions.key && authOptions.payload) {
      (options.headers as Record<string, string>)[authOptions.key] = authOptions.payload
    }
    else {
      console.error('Auth header not added:', {
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
 * @param options Additional request options including retry and timeout settings from ETLv2Options
 * @returns Promise with Result containing response data or error
 */
export async function processPostRequest(
  authOptions: AuthOptions | null,
  url: string,
  options: Record<string, any> = {},
): Promise<Result<any, Error>> {
  try {
    const { timeout = 30000, retryDelay = 1000, json, retry } = options
    const authRequestOptions = createAuthenticatedOptions(authOptions)
    const response = await ofetch(url, {
      method: 'POST',
      retry,
      retryDelay,
      retryStatusCodes: [408, 413, 429, 500, 502, 503, 504],
      timeout: timeout ? Number(timeout) : undefined,
      body: json,
      ...authRequestOptions,
    })

    return response
  }
  catch (error: any) {
    if (error.data) {
      throw new Error(`HTTP ${error.status}: ${JSON.stringify(error.data)}`)
    }
    else if (error.status) {
      throw new Error(`HTTP ${error.status}: ${error.statusText || error.message}`)
    }
    else {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }
}

export interface GetResponseData {
  data: any
  source_type: string
  target_type: string
}

/**
 * Process a GET request with authentication headers and ETLv2 options
 * @param authOptions Authentication options
 * @param url The URL to request
 * @param options Additional request options including retry and timeout settings from ETLv2Options
 * @param sourceType The source type identifier
 * @returns Promise with Result containing response data or error
 */
export async function processGetRequest(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
): Promise<Result<GetResponseData, Error>> {
  const authRequestOptions = createAuthenticatedOptions(authOptions)
  const mergedOptions = { ...authRequestOptions, ...options }

  const { timeout = 30000, retry, retryDelay = 1000, ...restOptions } = mergedOptions

  try {
    const response = await ofetch(url, {
      method: 'GET',
      retry,
      retryDelay,
      retryStatusCodes: [408, 413, 429, 500, 502, 503, 504],
      timeout: Number(timeout) ? Number(timeout) : 0,
      ...restOptions,
    })
    return ok(response)
  }
  catch (error: any) {
    if (error.data) {
      throw new Error(`HTTP ${error.status}: ${JSON.stringify(error.data)}`)
    }
    else if (error.status) {
      throw new Error(`HTTP ${error.status}: ${error.statusText || error.message}`)
    }
    else {
      throw error instanceof Error ? error : new Error(String(error))
    }
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

/**
 * Process multiple requests in batches with concurrency and throttling control
 * @param requests Array of request functions to execute
 * @param concurrencyLimit Maximum number of concurrent requests (default: 10)
 * @param throttleLimit Maximum number of requests per interval (default: 10)
 * @param throttleInterval Time interval for throttling in milliseconds (default: 1000)
 * @param options Additional request options including ETLv2Options parameters
 * @returns Promise with Result containing array of responses or error
 */
export async function processBatchedRequests<R, E>(
  requests: Array<() => Promise<Result<R, E>>>,
  concurrencyLimit = 10,
  throttleLimit = 10,
  throttleInterval = 1000,
  options: RequestOptions = {},
): Promise<Result<R[], E>> {
  try {
    const {
      retry = 0,
      retryDelay = 1000,
      showProgress = false,
      progressLabel = 'requests',
    } = options

    const throttle = pThrottle({
      limit: throttleLimit,
      interval: throttleInterval,
    })
    console.warn('Processing', progressLabel, 'with concurrency limit:', concurrencyLimit, 'throttle limit:', throttleLimit, 'throttle interval:', throttleInterval)

    const progressBar = createProgressBar({
      total: requests.length,
      label: progressLabel,
      show: showProgress,
    })

    const throttledRequests = requests.map((req, index) => {
      return throttle(async () => {
        let lastError: any
        let attempts = 0
        const maxAttempts = retry ? Number(retry) : 0

        while (attempts <= maxAttempts) {
          try {
            const result = await req()

            updateProgressBar(progressBar)

            return result as Result<R, E>
          }
          catch (error) {
            lastError = error
            attempts++

            if (attempts <= maxAttempts) {
              console.warn(
                `Request ${index} failed (attempt ${attempts}/${maxAttempts}). Retrying in ${retryDelay}ms...`,
                error instanceof Error ? error.message : error,
              )
            }
            else {
              console.error(
                `Request ${index} failed after ${maxAttempts} attempts.`,
                error instanceof Error ? error.message : error,
              )
            }

            if (attempts > maxAttempts) {
              break
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }

        if (progressBar) {
          progressBar.increment()
        }

        return err(lastError instanceof Error ? lastError : new Error(String(lastError))) as Result<R, E>
      })
    }) as Array<() => Promise<Result<R, E>>>

    const batchSize = 10

    const batchResults = await processBatchesWithLimit(
      throttledRequests,
      batchSize,
      async (batch: Array<() => Promise<Result<R, E>>>) => {
        const results = await Promise.all(batch.map((req: () => Promise<Result<R, E>>) => req()))
        return results
      },
      concurrencyLimit,
    )

    stopProgressBar(progressBar)

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

    return ok(results)
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw err(error instanceof Error ? error as E : new Error(`Batch processing error: ${errorMessage}`) as E)
  }
}
