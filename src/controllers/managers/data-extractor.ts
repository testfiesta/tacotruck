import type { ResponseData } from '../../services/api-client'
import type { ConfigType } from '../../utils/config-schema'
import type { AuthOptions } from './authentication-manager'
import { apiClient } from '../../services/api-client'
import { ConfigurationError, ErrorManager, ETLErrorType, NetworkError } from './error-manager'

export interface ExtractionOptions {
  authOptions?: AuthOptions | null
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

export interface ExtractionResult {
  data: Record<string, any>
  metadata: {
    extractedAt: Date
    endpoints: string[]
    recordCounts: Record<string, number>
    duration: number
    errors: any[]
  }
}

export class DataExtractor {
  private config: ConfigType
  private errorManager: ErrorManager
  private options: ExtractionOptions

  constructor(
    config: ConfigType,
    options: ExtractionOptions = {},
    errorManager?: ErrorManager,
  ) {
    this.config = config
    this.options = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options,
    }
    this.errorManager = errorManager || new ErrorManager()
  }

  /**
   * Extract data from source system based on configuration
   * @param ids Optional record of IDs to fetch specific resources
   * @returns Extraction result with data and metadata
   */
  async extract(ids: Record<string, Array<Record<string, any>>> = {}): Promise<ExtractionResult> {
    const startTime = Date.now()
    const extractedAt = new Date()
    const data: Record<string, any> = {
      source: this.config.name || 'unknown',
    }
    const recordCounts: Record<string, number> = {}
    const errors: any[] = []

    try {
      this.validateExtractionConfig()

      const { endpoints, fetchType } = this.determineEndpointsAndFetchType(ids)

      for (const endpoint of endpoints) {
        try {
          const endpointData = await this.extractEndpointData(endpoint, fetchType, ids)
          data[endpoint] = endpointData
          recordCounts[endpoint] = Array.isArray(endpointData) ? endpointData.length : 1
        }
        catch (error) {
          const etlError = ErrorManager.handleError(
            error,
            ETLErrorType.DATA,
            { endpoint, operation: 'extract', entityType: endpoint },
          )
          this.errorManager.addError(etlError)
          errors.push(etlError.toJSON())

          // Continue with other endpoints unless it's a critical error
          if (!etlError.isRetryable) {
            console.warn(`Failed to extract data from endpoint ${endpoint}: ${etlError.message}`)
          }
        }
      }

      const duration = Date.now() - startTime

      return {
        data,
        metadata: {
          extractedAt,
          endpoints,
          recordCounts,
          duration,
          errors,
        },
      }
    }
    catch (error) {
      const etlError = ErrorManager.handleError(error, ETLErrorType.DATA)
      this.errorManager.addError(etlError)
      throw etlError
    }
  }

  /**
   * Extract data from a specific endpoint
   * @param endpoint The endpoint name
   * @param fetchType The fetch type ('index' or 'get')
   * @param ids Optional IDs for parameterized requests
   * @returns The extracted data
   */
  private async extractEndpointData(
    endpoint: string,
    fetchType: 'index' | 'get',
    ids: Record<string, Array<Record<string, any>>> = {},
  ): Promise<any> {
    const rawPath = this.getEndpointRawPath(endpoint, fetchType)

    if (!rawPath) {
      throw new ConfigurationError(
        `No ${fetchType} path configured for endpoint ${endpoint}`,
        { endpoint, operation: 'extract' },
      )
    }

    // Handle simple GET requests without parameters
    if (!rawPath.includes('{')) {
      return await this.processSimpleGetRequest(rawPath, endpoint)
    }

    // Handle parameterized GET requests
    return await this.processParameterizedGetRequest(rawPath, endpoint, fetchType, ids)
  }

  /**
   * Process a simple GET request without parameters
   * @param rawPath The raw path to use
   * @param endpoint The endpoint name
   * @returns The response data
   */
  private async processSimpleGetRequest(rawPath: string, endpoint: string): Promise<any> {
    const url = this.buildUrl(rawPath)

    try {
      const response = await this.makeRequest(url, 'GET')
      return response ? this.processResponseData(response as ResponseData, endpoint) : null
    }
    catch (error) {
      throw new NetworkError(
        `Failed to fetch data from ${endpoint}`,
        {
          endpoint,
          url,
          operation: 'extract',
          originalError: error instanceof Error ? error : new Error(String(error)),
        },
      )
    }
  }

  /**
   * Process a parameterized GET request
   * @param rawPath The raw path with parameters
   * @param endpoint The endpoint name
   * @param fetchType The fetch type
   * @param ids The IDs to use for parameterization
   * @returns The response data
   */
  private async processParameterizedGetRequest(
    rawPath: string,
    endpoint: string,
    fetchType: 'index' | 'get',
    ids: Record<string, Array<Record<string, any>>>,
  ): Promise<any[]> {
    const endpointIds = ids[endpoint] || []
    const results: any[] = []

    if (endpointIds.length === 0) {
      console.warn(`No IDs provided for parameterized endpoint ${endpoint}`)
      return results
    }

    for (const idRecord of endpointIds) {
      try {
        const parameterizedPath = this.substituteParameters(rawPath, idRecord)
        const url = this.buildUrl(parameterizedPath)

        const response = await this.makeRequest(url, 'GET')
        const processedData = response ? this.processResponseData(response as ResponseData, endpoint) : null

        if (processedData) {
          results.push(processedData)
        }
      }
      catch (error) {
        const etlError = new NetworkError(
          `Failed to fetch data for ${endpoint} with ID ${JSON.stringify(idRecord)}`,
          {
            endpoint,
            operation: 'extract',
            requestData: idRecord,
            originalError: error instanceof Error ? error : new Error(String(error)),
          },
        )
        this.errorManager.addError(etlError)
        // Continue with next ID
      }
    }

    return results
  }

  /**
   * Make an HTTP request with retry logic
   * @param url The URL to request
   * @param method The HTTP method
   * @returns The response data
   */
  // eslint-disable-next-line unused-imports/no-unused-vars
  private async makeRequest(url: string, method: 'GET' | 'POST' = 'GET'): Promise<ResponseData | null> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= (this.options.retryAttempts || 3); attempt++) {
      try {
        const response = await apiClient.processGetRequest(
          this.options.authOptions!,
          url,
          {
            timeout: this.options.timeout,
            retry: this.options.retryAttempts,
            retryDelay: this.options.retryDelay,
          },
          'source',
        )

        return response
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on certain error types
        if (this.isNonRetryableError(error)) {
          throw lastError
        }

        // Wait before retry (except on last attempt)
        if (attempt < (this.options.retryAttempts || 3)) {
          await this.delay((this.options.retryDelay || 1000) * attempt)
        }
      }
    }

    throw lastError || new Error('Request failed after all retry attempts')
  }

  /**
   * Process response data according to endpoint configuration
   * @param response The API response
   * @param endpoint The endpoint name
   * @returns Processed data
   */
  private processResponseData(response: ResponseData, endpoint: string): any {
    if (!response || typeof response !== 'object') {
      return response
    }

    const endpointConfig = this.getEndpointConfig(endpoint)
    const responseData = response as Record<string, any>

    if (endpointConfig?.data_key && (response as Record<string, any>)[endpointConfig.data_key]) {
      return (response as Record<string, any>)[endpointConfig.data_key]
    }

    const commonDataKeys = ['data', 'results', 'items', 'entries']
    for (const key of commonDataKeys) {
      if ((response as Record<string, any>)[key]) {
        return (response as Record<string, any>)[key]
      }
    }

    return response
  }

  /**
   * Build complete URL from path
   * @param path The path to append to base URL
   * @returns Complete URL
   */
  private buildUrl(path: string): string {
    const baseUrl = this.options.baseUrl || ''

    if (!baseUrl) {
      throw new ConfigurationError('Base URL is required for data extraction')
    }

    // Ensure proper URL construction
    const cleanBase = baseUrl.replace(/\/+$/, '')
    const cleanPath = path.replace(/^\/+/, '')

    return `${cleanBase}/${cleanPath}`
  }

  /**
   * Substitute parameters in a path template
   * @param path The path template with placeholders
   * @param parameters The parameters to substitute
   * @returns Path with substituted parameters
   */
  private substituteParameters(path: string, parameters: Record<string, any>): string {
    let result = path

    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{${key}}`
      result = result.replace(new RegExp(placeholder, 'g'), encodeURIComponent(String(value)))
    }

    const remainingPlaceholders = result.match(/\{[^}]+\}/g)
    if (remainingPlaceholders) {
      throw new ConfigurationError(
        `Unsubstituted placeholders in path: ${remainingPlaceholders.join(', ')}`,
        { path: result, parameters },
      )
    }

    return result
  }

  /**
   * Get endpoint configuration
   * @param endpoint The endpoint name
   * @returns Endpoint configuration or undefined
   */
  private getEndpointConfig(endpoint: string): any {
    if (this.config.type === 'api' && this.config.source && endpoint in this.config.source) {
      return this.config.source[endpoint]
    }
    return undefined
  }

  /**
   * Get the appropriate raw path for an endpoint based on fetch type
   * @param endpoint The endpoint name
   * @param fetchType The fetch type ('index' or 'get')
   * @returns The raw path or undefined if not found
   */
  private getEndpointRawPath(endpoint: string, fetchType: 'index' | 'get'): string | undefined {
    const endpointConfig = this.getEndpointConfig(endpoint)

    if (endpointConfig?.endpoints) {
      return fetchType === 'index'
        ? endpointConfig.endpoints?.index?.path
        : endpointConfig.endpoints?.get?.path
    }

    return undefined
  }

  /**
   * Determine endpoints and fetch type based on configuration and provided IDs
   * @param ids Optional record of IDs to fetch specific resources
   * @returns Object containing endpoints and fetch type
   */
  private determineEndpointsAndFetchType(
    ids: Record<string, Array<Record<string, any>>> = {},
  ): { endpoints: string[], fetchType: 'index' | 'get' } {
    if (Object.keys(ids).length > 0) {
      return {
        endpoints: Object.keys(ids),
        fetchType: 'get',
      }
    }

    // Get endpoints from source configuration
    if (this.config.type === 'api' && this.config.source) {
      return {
        endpoints: Object.keys(this.config.source),
        fetchType: 'index',
      }
    }

    return {
      endpoints: [],
      fetchType: 'index',
    }
  }

  /**
   * Validate extraction configuration
   * @throws ConfigurationError if configuration is invalid
   */
  private validateExtractionConfig(): void {
    if (this.config.type !== 'api') {
      throw new ConfigurationError(
        `Extraction not supported for configuration type: ${this.config.type}`,
      )
    }

    if (!this.config.source || Object.keys(this.config.source).length === 0) {
      throw new ConfigurationError('No source endpoints configured for extraction')
    }

    if (!this.options.baseUrl) {
      throw new ConfigurationError('Base URL is required for API extraction')
    }
  }

  /**
   * Check if an error should not be retried
   * @param error The error to check
   * @returns True if the error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // Don't retry on authentication/authorization errors
      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return true
      }

      // Don't retry on client errors (4xx status codes)
      if (message.includes('400') || message.includes('404') || message.includes('422')) {
        return true
      }
    }

    return false
  }

  /**
   * Delay execution for specified milliseconds
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get error manager for accessing extraction errors
   * @returns The error manager instance
   */
  getErrorManager(): ErrorManager {
    return this.errorManager
  }

  /**
   * Update extraction options
   * @param options New options to merge
   */
  updateOptions(options: Partial<ExtractionOptions>): void {
    this.options = { ...this.options, ...options }
  }
}
