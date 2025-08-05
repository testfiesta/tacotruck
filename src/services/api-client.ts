import type { ConfigType } from '../utils/config-schema'
import type { AuthOptions, RequestOptions } from '../utils/network'
import * as networkUtils from '../utils/network'
import * as urlBuilder from '../utils/url-builder'

export interface ResponseData {
  data: any
  source_type: string
  target_type: string
}

export class ApiClient {
  /**
   * Process a network GET request with authentication headers
   * @param authOptions Authentication options
   * @param url The URL to request
   * @param options Additional request options
   * @param sourceType The source type for response data
   * @param fallbackData Optional fallback data to use if the request fails
   * @returns Promise with response data or fallback data or null
   */
  async processGetRequest(
    authOptions: AuthOptions | null,
    url: string,
    options: RequestOptions = {},
    sourceType: string,
    fallbackData?: ResponseData,
  ): Promise<ResponseData | null> {
    const result = await networkUtils.processGetRequest(authOptions, url, options, sourceType)

    return result.match({
      ok: (value: any) => value,
      err: (error: Error) => {
        return fallbackData || null
      },
    })
  }

  /**
   * Process a network POST request with authentication headers
   * @param authOptions Authentication options
   * @param url The URL to request
   * @param options Additional request options
   * @param fallbackResponse Optional fallback response to use if the request fails
   * @returns Promise with response data or fallback response
   */
  async processPostRequest(
    authOptions: AuthOptions | null,
    url: string,
    options: RequestOptions = {},
    fallbackResponse?: Response,
  ): Promise<Response | null> {
    const result = await networkUtils.processPostRequest(authOptions, url, options)

    return result.match({
      ok: (value: any) => value,
      err: (error: Error) => {
        return fallbackResponse || null
      },
    })
  }

  /**
   * Build a complete URL from base path and raw path
   * @param basePath The base path (can be empty)
   * @param rawPath The raw path to build from
   * @returns The complete URL
   */
  buildUrl(basePath: string | undefined, rawPath: string): string {
    return (basePath || '') + rawPath
  }

  /**
   * Build multiple URLs based on endpoint configuration
   * @param config The endpoint configuration
   * @param rawPath The raw path template
   * @param data The data to use for substitutions
   * @param endpoint The endpoint name
   * @param fetchType The fetch type (index or get)
   * @param ids Optional record of IDs for specific resources
   * @returns Array of constructed URLs
   */
  buildUrls(
    config: ConfigType,
    rawPath: string,
    data: Record<string, any>,
    endpoint: string,
    fetchType: 'index' | 'get',
    ids: Record<string, Array<Record<string, any>>> = {},
  ): string[] {
    return urlBuilder.buildUrls(config, rawPath, data, endpoint, fetchType, ids)
  }

  /**
   * Create a queue with concurrency control
   * @param defaultConcurrency Default concurrency if not specified in config
   * @returns A PQueue instance
   */
  createQueue(defaultConcurrency: number) {
    return networkUtils.createQueue(defaultConcurrency)
  }
}

export const apiClient = new ApiClient()
