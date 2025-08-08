import type { ConfigType } from '../../utils/config-schema'
import type { RequestOptions } from '../../utils/network'
import type { AuthOptions } from './authentication-manager'
import { apiClient } from '../../services/api-client'
import { processBatches } from '../../utils/batch-processor'
import { getLogger } from '../../utils/logger'
import { substituteUrlStrict } from '../../utils/url-substitutor'
import { ConfigurationError, ErrorManager, ETLErrorType, NetworkError, ValidationError } from './error-manager'

export interface LoadingOptions {
  authOptions?: AuthOptions | null
  baseUrl?: string
  basePath?: string
  throttleCap?: number
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  verbose?: boolean
  validateBeforeLoad?: boolean
  batchSize?: number
  maxConcurrency?: number
}

export interface LoadingResult {
  metadata: {
    loadedAt: Date
    duration: number
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    recordCounts: Record<string, number>
    endpoints: string[]
    errors: any[]
  }
  responses: Record<string, any>
}

export interface LoadRequest {
  url: string
  options: RequestOptions
  endpoint: string
  operation: string
  data: any
}

export class DataLoader {
  private config: ConfigType
  private errorManager: ErrorManager
  private options: LoadingOptions
  private targetUrls: Record<string, Record<string, string>> = {}

  constructor(
    config: ConfigType,
    options: LoadingOptions = {},
    errorManager?: ErrorManager,
  ) {
    this.config = config
    this.options = {
      throttleCap: 5,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      validateBeforeLoad: true,
      batchSize: 100,
      maxConcurrency: 5,
      basePath: '',
      verbose: false,
      ...options,
    }
    this.errorManager = errorManager || new ErrorManager()
  }

  /**
   * Load data to target endpoints
   * @param data The data to load
   * @returns Loading result with metadata and responses
   */
  async load(data: Record<string, any>): Promise<LoadingResult> {
    const startTime = Date.now()
    const loadedAt = new Date()
    const recordCounts: Record<string, number> = {}
    const endpoints: string[] = []
    const errors: any[] = []
    const responses: Record<string, any> = {}

    try {
      this.validateLoadingConfig()

      if (this.options.validateBeforeLoad) {
        this.validateDataAgainstConfig(data)
      }

      const requestPromises: LoadRequest[] = []
      const multiBulkData: Record<string, any[]> = {}

      const multiTarget = (this.config as any).multi_target

      for (const endpoint of Object.keys(data)) {
        if (endpoint === 'source') {
          continue
        }

        if (!this.config.target || !this.config.target[endpoint]) {
          const error = this.errorManager.configurationError(
            `Data found for [${endpoint}] but no target configuration exists`,
            { endpoint },
          )
          errors.push(error.toJSON())
          continue
        }

        endpoints.push(endpoint)
        const endpointData = data[endpoint]
        recordCounts[endpoint] = Array.isArray(endpointData) ? endpointData.length : 1
        try {
          const bulkData = this.processEndpointData({
            endpoint,
            data,
            multiTarget: !!multiTarget,
            requestPromises,
          })

          if (multiTarget && this.validateBulkData(bulkData)) {
            multiBulkData[endpoint] = bulkData
          }
          else if (!multiTarget && this.validateBulkData(bulkData)) {
            this.handleEndpointBulkData({
              endpoint,
              bulkData,
              requestPromises,
            })
          }
        }
        catch (error) {
          const etlError = ErrorManager.handleError(
            error,
            ETLErrorType.DATA,
            { endpoint, operation: 'load' },
          )
          this.errorManager.addError(etlError)
          errors.push(etlError.toJSON())
        }
      }

      if (multiTarget && this.validateMultiBulkData(multiBulkData)) {
        this.processMultiTargetBulkData({
          multiBulkData,
          multiTarget,
          data,
          requestPromises,
        })
      }

      let successfulRequests = 0
      let failedRequests = 0

      if (requestPromises.length > 0) {
        const batchResults = await this.executeBatchRequests(requestPromises)

        for (const result of batchResults) {
          if (result.success) {
            successfulRequests++
            if (result.endpoint) {
              responses[result.endpoint] = result.response
            }
          }
          else {
            failedRequests++
            if (result.error) {
              this.errorManager.addError(result.error)
              errors.push(result.error.toJSON())
            }
          }
        }
      }

      const duration = Date.now() - startTime

      return {
        metadata: {
          loadedAt,
          duration,
          totalRequests: requestPromises.length,
          successfulRequests,
          failedRequests,
          recordCounts,
          endpoints,
          errors,
        },
        responses,
      }
    }
    catch (error) {
      const etlError = ErrorManager.handleError(error, ETLErrorType.DATA)
      this.errorManager.addError(etlError)
      throw etlError
    }
  }

  /**
   * Load data to a specific target endpoint
   * @param targetType The target type (projects, suites, cases, etc.)
   * @param data The data to load
   * @param endpoint The endpoint type (create, update, etc.)
   * @returns The response from the target system
   */
  async loadToTarget(
    targetType: string,
    data: any,
    endpoint: string = 'create',
    params?: Record<string, any>,
  ): Promise<Record<string, any>> {
    const target = this.config.target?.[targetType]?.endpoints?.[endpoint]

    if (!target) {
      throw new ConfigurationError(
        `No ${endpoint} endpoint defined for ${targetType} in target configuration`,
        { targetType, endpoint },
      )
    }

    const targetPath = this.getTargetUrl(targetType, endpoint, target)
    const url = this.buildEndpointUrl(targetPath, params)

    if (this.options.verbose) {
      const logger = getLogger()
      logger.warn('url for loading to target', { url })
    }

    try {
      const response = await apiClient.processPostRequest(
        this.options.authOptions || null,
        url,
        {
          json: data,
          timeout: this.options.timeout,
          retry: this.options.retryAttempts,
          retryDelay: this.options.retryDelay,
        },
      )
      return response || {}
    }
    catch (error) {
      throw new NetworkError(
        `Failed to load data to ${targetType}.${endpoint}`,
        {
          targetType,
          endpoint,
          url,
          data,
          originalError: error instanceof Error ? error : new Error(String(error)),
        },
      )
    }
  }

  /**
   * Execute batch requests with concurrency control and retry logic
   * @param requests Array of load requests
   * @returns Array of batch results
   */
  private async executeBatchRequests(requests: LoadRequest[]): Promise<Array<{
    success: boolean
    response?: any
    error?: any
    endpoint?: string
  }>> {
    const results: Array<{
      success: boolean
      response?: any
      error?: any
      endpoint?: string
    }> = []

    await processBatches(
      requests,
      this.options.throttleCap || 5,
      async (batch) => {
        const batchPromises = batch.map(async (request) => {
          try {
            const response = await apiClient.processPostRequest(
              this.options.authOptions || null,
              request.url,
              {
                ...request.options,
                timeout: this.options.timeout,
                retry: this.options.retryAttempts,
                retryDelay: this.options.retryDelay,
              },
            )
            return {
              success: true,
              response,
              endpoint: request.endpoint,
            }
          }
          catch (error) {
            const etlError = new NetworkError(
              `Failed to load data to ${request.endpoint}`,
              {
                endpoint: request.endpoint,
                operation: request.operation,
                url: request.url,
                data: request.data,
                originalError: error instanceof Error ? error : new Error(String(error)),
              },
            )
            return {
              success: false,
              error: etlError,
              endpoint: request.endpoint,
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        return batchResults.filter(r => r.success).map(r => r.response)
      },
    )

    return results
  }

  /**
   * Process endpoint data and prepare load requests
   * @param params Processing parameters
   * @returns Bulk data for further processing
   */
  private processEndpointData(params: {
    endpoint: string
    data: Record<string, any>
    multiTarget: boolean
    requestPromises: LoadRequest[]
  }): any[] {
    const { endpoint, data, multiTarget, requestPromises } = params
    const endpointData = data[endpoint]

    if (!Array.isArray(endpointData)) {
      return []
    }

    const targetConfig = this.config.target?.[endpoint]
    if (!targetConfig?.endpoints?.create) {
      throw new ConfigurationError(
        `No create endpoint configuration for ${endpoint}`,
        { endpoint },
      )
    }

    const createEndpoint = targetConfig.endpoints.create

    // Handle bulk operations
    if (createEndpoint.bulk_path && !multiTarget) {
      const url = this.buildEndpointUrl(createEndpoint.bulk_path)
      const formattedData = this.formatDataForTarget(endpointData, createEndpoint)

      requestPromises.push({
        url,
        options: { json: formattedData },
        endpoint,
        operation: 'bulk_create',
        data: endpointData,
      })
    }

    // Handle individual operations
    if (createEndpoint.single_path && !multiTarget) {
      for (const item of endpointData) {
        const url = this.buildEndpointUrl(createEndpoint.single_path)
        const formattedData = this.formatDataForTarget(item, createEndpoint)

        requestPromises.push({
          url,
          options: { json: formattedData },
          endpoint,
          operation: 'single_create',
          data: item,
        })
      }
    }

    return endpointData
  }

  /**
   * Handle endpoint bulk data loading
   * @param params Bulk data handling parameters
   */
  private handleEndpointBulkData(params: {
    endpoint: string
    bulkData: any[]
    requestPromises: LoadRequest[]
  }): void {
    const { endpoint, bulkData, requestPromises } = params
    const targetConfig = this.config.target?.[endpoint]?.endpoints?.create

    if (!targetConfig) {
      return
    }

    if (targetConfig.bulk_path) {
      const url = this.buildEndpointUrl(targetConfig.bulk_path)
      const formattedData = this.formatDataForTarget(bulkData, targetConfig)

      requestPromises.push({
        url,
        options: { json: formattedData },
        endpoint,
        operation: 'bulk_create',
        data: bulkData,
      })
    }
  }

  /**
   * Process multi-target bulk data
   * @param params Multi-target processing parameters
   */
  private processMultiTargetBulkData(params: {
    multiBulkData: Record<string, any[]>
    multiTarget: any
    data: Record<string, any>
    requestPromises: LoadRequest[]
  }): void {
    const { multiBulkData, multiTarget, data, requestPromises } = params

    if (!multiTarget.path) {
      throw new ConfigurationError('Multi-target path is required')
    }

    const url = this.buildEndpointUrl(multiTarget.path)
    const formattedData: Record<string, any> = {}

    if (multiTarget.data_key) {
      formattedData[multiTarget.data_key] = multiBulkData
    }
    else {
      formattedData.data = multiBulkData
    }

    if (multiTarget.include_source && data.source) {
      formattedData.source = data.source
    }

    requestPromises.push({
      url,
      options: { json: formattedData },
      endpoint: 'multi_target',
      operation: 'multi_bulk_create',
      data: multiBulkData,
    })
  }

  /**
   * Format data for target endpoint according to configuration
   * @param data The data to format
   * @param targetConfig The target configuration
   * @returns Formatted data
   */
  private formatDataForTarget(data: any, targetConfig: any): Record<string, any> {
    const formattedData: Record<string, any> = {}
    if (targetConfig.data_key) {
      formattedData[targetConfig.data_key] = data
    }
    else {
      formattedData.data = data
    }

    if (targetConfig.include_source) {
      formattedData.source = this.config.name || 'unknown'
    }
    return formattedData
  }

  /**
   * Get target URL for a specific endpoint
   * @param targetType The target type
   * @param operation The operation type
   * @param targetConfig The target configuration
   * @returns The complete URL
   */
  private getTargetUrl(targetType: string, operation: string, targetConfig: any): string {
    // Try to get from precomputed URLs first
    if (this.targetUrls[targetType]?.[operation] && !this.targetUrls[targetType]?.[operation].includes('{')) {
      return this.targetUrls[targetType][operation]
    }
    // Fallback to building URL from config
    let path = ''
    if (operation === 'create' && targetConfig.bulk_path) {
      path = targetConfig.bulk_path
    }
    else if (operation === 'create' && targetConfig.single_path) {
      path = targetConfig.single_path
    }
    else if (targetConfig.path) {
      path = targetConfig.path
    }

    if (!path) {
      throw new ConfigurationError(
        `No path configuration found for ${targetType}.${operation}`,
      )
    }
    return path
  }

  /**
   * Build complete endpoint URL
   * @param path The endpoint path
   * @returns Complete URL
   */
  private buildEndpointUrl(path: string, params?: Record<string, any>): string {
    const baseUrl = this.options.baseUrl || ''
    if (!baseUrl) {
      throw new ConfigurationError('Base URL is required for data loading')
    }
    const cleanBase = baseUrl.replace(/\/+$/, '')

    const basePath = this.config.base_path || ''
    const pathHasBasePath = path.startsWith(basePath)

    const pathWithBase = pathHasBasePath ? path : (basePath + path).replace(/^\/+/, '')
    return substituteUrlStrict(`${cleanBase}/${pathWithBase}`, params || {})
  }

  /**
   * Validate data against configuration requirements
   * @param data The data to validate
   */
  private validateDataAgainstConfig(data: Record<string, any>): void {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Data must be an object')
    }

    if (!this.config.target || Object.keys(this.config.target).length === 0) {
      throw new ConfigurationError('No target configuration found')
    }

    // Validate that data exists for configured targets
    // eslint-disable-next-line unused-imports/no-unused-vars
    const configuredTargets = Object.keys(this.config.target)
    const dataKeys = Object.keys(data).filter(key => key !== 'source')

    if (dataKeys.length === 0) {
      throw new ValidationError('No data found to load')
    }

    // Check for required fields based on target configuration
    for (const endpoint of dataKeys) {
      if (!this.config.target[endpoint]) {
        throw new ConfigurationError(
          `No target configuration found for data endpoint: ${endpoint}`,
        )
      }

      const endpointData = data[endpoint]
      if (!endpointData) {
        throw new ValidationError(`No data found for endpoint: ${endpoint}`)
      }
    }
  }

  /**
   * Validate loading configuration
   */
  private validateLoadingConfig(): void {
    if (!this.options.baseUrl) {
      throw new ConfigurationError('Base URL is required for data loading')
    }

    if (!this.config.target || Object.keys(this.config.target).length === 0) {
      throw new ConfigurationError('No target endpoints configured for loading')
    }
  }

  /**
   * Validate bulk data
   * @param bulkData The bulk data to validate
   * @returns True if data is valid for bulk operations
   */
  private validateBulkData(bulkData: any): boolean {
    return Array.isArray(bulkData) && bulkData.length > 0
  }

  /**
   * Validate multi-bulk data
   * @param multiBulkData The multi-bulk data to validate
   * @returns True if data is valid for multi-bulk operations
   */
  private validateMultiBulkData(multiBulkData: Record<string, any[]>): boolean {
    return Object.keys(multiBulkData).length > 0
      && Object.values(multiBulkData).some(data => Array.isArray(data) && data.length > 0)
  }

  /**
   * Get error manager for accessing loading errors
   * @returns The error manager instance
   */
  getErrorManager(): ErrorManager {
    return this.errorManager
  }

  /**
   * Update loading options
   * @param options New options to merge
   */
  updateOptions(options: Partial<LoadingOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * Get precomputed target URLs
   * @returns Record of target URLs
   */
  getTargetUrls(): Record<string, Record<string, string>> {
    return { ...this.targetUrls }
  }

  /**
   * Clear precomputed URLs (useful for testing)
   */
  clearTargetUrls(): void {
    this.targetUrls = {}
  }
}
