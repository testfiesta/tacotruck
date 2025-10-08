import type { FetchOptions } from 'ofetch'
import { ofetch } from 'ofetch'
import PQueue from 'p-queue'
import pThrottle from 'p-throttle'
import { processBatchesWithLimit } from './batch-processor'
import { createProgressBar, stopProgressBar, updateProgressBar } from './progress-bar'

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
 * JSON payload for requests - allows any serializable data structure
 */
export type JsonPayload = Record<string, unknown> | unknown[] | object

/**
 * Extended request options that include ETLv2Options parameters
 */
export interface RequestOptions extends FetchOptions {
  retryDelay?: number
  showProgress?: boolean
  progressLabel?: string
  onProgress?: (current: number, total: number) => void
}
export interface BatchRequestOptions {
  concurrencyLimit: number
  throttleLimit: number
  throttleInterval: number
}

export interface GetResponseData {
  data: any
  source_type: string
  target_type: string
}

/**
 * Create request options with authentication headers
 * @param authOptions The authentication options
 * @returns Request options with authentication headers
 */
export function createAuthenticatedOptions(
  authOptions: AuthOptions | null,
): Record<string, any> {
  const options = { headers: { 'Content-Type': 'application/json' } }

  if (!authOptions) {
    return options
  }

  if (authOptions.location === 'header') {
    options.headers = { 'Content-Type': 'application/json' }
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
export async function processPostRequest<T>(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  return await processRequest<T>(authOptions, url, 'POST', options)
}

/**
 * Process a PUT request with authentication headers
 * @param authOptions Authentication options
 * @param url The URL to request
 * @param options Additional request options including retry and timeout settings from ETLv2Options
 * @returns Promise with Result containing response data or error
 */
export async function processPutRequest<T>(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  return await processRequest<T>(authOptions, url, 'PUT', options)
}

/**
 * Process a PATCH request with authentication headers
 * @param authOptions Authentication options
 * @param url The URL to request
 * @param options Additional request options including retry and timeout settings from ETLv2Options
 * @returns Promise with Result containing response data or error
 */
export async function processPatchRequest<T>(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  return await processRequest<T>(authOptions, url, 'PATCH', options)
}

/**
 * Process a DELETE request with authentication headers
 * @param authOptions Authentication options
 * @param url The URL to request
 * @param options Additional request options including retry and timeout settings from ETLv2Options
 * @returns Promise with Result containing response data or error
 */
export async function processDeleteRequest<T>(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  return await processRequest<T>(authOptions, url, 'DELETE', options)
}

/**
 * Process a request with authentication headers
 * @param authOptions Authentication options
 * @param url The URL to request
 * @param options Additional request options including retry and timeout settings from ETLv2Options
 * @returns Promise with Result containing response data or error
 */
export async function processGetRequest<T = GetResponseData>(
  authOptions: AuthOptions | null,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  return await processRequest<T>(authOptions, url, 'GET', options)
}

export async function processRequest<T>(
  authOptions: AuthOptions | null,
  url: string,
  method: string,
  options: RequestOptions = {},
): Promise<T> {
  const authRequestOptions = createAuthenticatedOptions(authOptions)
  const mergedOptions = { ...authRequestOptions, ...options }

  const { timeout = 30000, retry, retryDelay = 1000, ...restOptions } = mergedOptions

  try {
    const response = await ofetch(url, {
      method,
      retry,
      retryDelay,
      retryStatusCodes: [408, 413, 429, 500, 502, 503, 504],
      timeout: Number(timeout) ? Number(timeout) : 0,
      ...restOptions,
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
 * @returns Promise with Result containing array of responses or error
 */
export async function processBatchedRequests<R>(
  requests: Array<() => Promise<R>>,
  batchOptions: BatchRequestOptions = {
    concurrencyLimit: 10,
    throttleLimit: 10,
    throttleInterval: 1000,
  },
  options: RequestOptions = {},
): Promise<R[]> {
  try {
    const {
      retry = 0,
      retryDelay = 1000,
      showProgress = false,
      progressLabel = 'requests',
      onProgress,
    } = options

    const throttle = pThrottle({
      limit: batchOptions.throttleLimit,
      interval: batchOptions.throttleInterval,
    })
    console.warn('Processing', progressLabel, 'with concurrency limit:', batchOptions.concurrencyLimit, 'throttle limit:', batchOptions.throttleLimit, 'throttle interval:', batchOptions.throttleInterval)

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
            if (onProgress) {
              onProgress(index + 1, requests.length)
            }

            return result
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

        if (onProgress) {
          onProgress(index + 1, requests.length)
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError))
      })
    }) as Array<() => Promise<R>>

    const batchSize = 10

    const batchResults = await processBatchesWithLimit(
      throttledRequests,
      batchSize,
      async (batch: Array<() => Promise<R>>) => {
        const results = await Promise.all(batch.map((req: () => Promise<R>) => req()))
        return results
      },
      batchOptions.concurrencyLimit,
    )

    stopProgressBar(progressBar)

    return batchResults.flat() as R[]
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw error instanceof Error ? error : new Error(`Batch processing error: ${errorMessage}`)
  }
}
