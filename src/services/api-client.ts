import type { ConfigType } from '../utils/config-schema'
import type { RequestOptions } from '../utils/network'
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
   * @param config The endpoint configuration
   * @param url The URL to request
   * @param options Additional request options
   * @param sourceType The source type for response data
   * @param fallbackData Optional fallback data to use if the request fails
   * @returns Promise with response data or fallback data or null
   */
  async processGetRequest(
    config: ConfigType,
    url: string,
    options: RequestOptions = {},
    sourceType: string,
    fallbackData?: ResponseData,
  ): Promise<ResponseData | null> {
    const result = await networkUtils.processGetRequest(config, url, options, sourceType)

    return result.match({
      ok: value => value,
      err: (error) => {
        console.warn(`Request to ${url} failed: ${error.message}. Using fallback data.`)
        return fallbackData || null
      },
    })
  }

  /**
   * Process a network POST request with authentication headers
   * @param config The endpoint configuration
   * @param url The URL to request
   * @param options Additional request options
   * @param fallbackResponse Optional fallback response to use if the request fails
   * @returns Promise with response data or fallback response
   */
  async processPostRequest(
    config: ConfigType,
    url: string,
    options: RequestOptions = {},
    fallbackResponse?: Response,
  ): Promise<Response | null> {
    const result = await networkUtils.processPostRequest(config, url, options)

    return result.match({
      ok: value => value,
      err: (error) => {
        console.warn(`Request to ${url} failed: ${error.message}. Using fallback response.`)
        return fallbackResponse || null
      },
    })
  }

  /**
   * Build a complete URL from configuration and path
   * @param config The endpoint configuration
   * @param rawPath The raw path to build from
   * @returns The complete URL
   */
  buildUrl(config: ConfigType, rawPath: string): string {
    return (config.base_path || '') + rawPath
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
