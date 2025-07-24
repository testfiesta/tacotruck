import type { ResponseData } from '../services/api-client'
import type { ConfigType } from '../utils/config-schema'
import type { RequestOptions } from '../utils/network'
import * as fs from 'node:fs'
import FormData from 'form-data'
import { apiClient } from '../services/api-client'
import { applySourceControlInfo, processBatches, processResponseData } from '../utils/batch-processor'
import * as dataUtils from '../utils/data'
import { bracketSubstitution, findSubstitutionKeys } from '../utils/enhanced-config-loader'

const TARGET_CONCURRENCY = 5

export class ETL {
  protected config: ConfigType
  protected endpointSet: string[] = []
  protected apiClient: typeof apiClient
  protected baseUrl: string = ''
  protected throttleCap: number = TARGET_CONCURRENCY
  protected direction: string = 'target'
  protected integration: string = 'default'
  protected offsets: Record<string, any> = {}
  protected source_control: Record<string, Record<string, any>> = {}
  protected targetUrls: Record<string, Record<string, string>> = {}

  /**
   * Create a new ETL instance
   * @param configSchema The full configuration schema
   */
  constructor(configSchema: ConfigType) {
    this.config = configSchema
    this.apiClient = apiClient
    this.initializeConfig()
  }

  /**
   * Initialize the configuration with default values and set up class properties from config
   */
  protected initializeConfig(): void {
    // Set up base properties from config
    this.direction = 'target' // Default direction
    this.integration = 'default'

    // Set integration name if available in config
    if (this.config.type === 'api' || this.config.type === 'json' || this.config.type === 'junit') {
      if ('name' in this.config) {
        this.integration = this.config.name
      }
    }
    this.throttleCap = TARGET_CONCURRENCY
    this.offsets = {}
    this.source_control = {}

    // Initialize endpoint set
    if (this.config.type === 'api' && this.config.source) {
      this.endpointSet = Object.keys(this.config.source)
    }
    else {
      this.endpointSet = []
    }

    // Set up base URL if available
    // First check for baseUrl in the config (for test compatibility)
    if ('baseUrl' in this.config) {
      this.baseUrl = this.config.baseUrl as string
    }
    // Otherwise use base_path if available
    else if (this.config.type === 'api' && this.config.base_path) {
      this.baseUrl = this.config.base_path
    }

    // Precompute URLs for all targets
    this.precomputeTargetUrls()
  }

  /**
   * Precomputes URLs for all targets to optimize URL construction
   */
  private precomputeTargetUrls(): void {
    if (!this.config.target)
      return

    this.targetUrls = {}

    // Iterate through all targets
    for (const entityType of Object.keys(this.config.target)) {
      const entity = this.config.target[entityType]
      if (!entity.endpoints)
        continue

      this.targetUrls[entityType] = {}

      if (entity.endpoints.update) {
        const updateEndpoint = entity.endpoints.update
        if (updateEndpoint.path) {
          this.targetUrls[entityType].update = this.buildEndpointUrl(updateEndpoint.path)
        }
      }

      if (entity.endpoints.create) {
        const createEndpoint = entity.endpoints.create
        if (createEndpoint.single_path) {
          this.targetUrls[entityType].create = this.buildEndpointUrl(createEndpoint.single_path)
        }
        if (createEndpoint.bulk_path) {
          this.targetUrls[entityType].bulk = this.buildEndpointUrl(createEndpoint.bulk_path)
        }
      }
    }

    if ('multi_target' in this.config && this.config.multi_target?.path) {
      this.targetUrls.multi_target = {
        path: this.buildEndpointUrl(this.config.multi_target.path),
      }
    }
  }

  /**
   * Execute the ETL process
   * @param ids Optional record of IDs to fetch specific resources
   * @returns The processed data
   */
  async execute(ids: Record<string, Array<Record<string, any>>> = {}): Promise<Record<string, any>> {
    return await this.executeETL(ids)
  }

  /**
   * Extract data from source system based on configuration
   * @param ids Optional record of IDs to fetch specific resources
   * @returns Record containing extracted data
   */
  async extract(ids: Record<string, Array<Record<string, any>>> = {}): Promise<Record<string, any>> {
    return await this.extractData(ids)
  }

  /**
   * Transform data according to mapping rules
   * @param data The data to transform
   * @returns The transformed data
   */
  transform(data: Record<string, any>): Record<string, any> {
    return this.transformData(data)
  }

  /**
   * Load data to target system
   * @param data The data to load
   */
  async load(data: Record<string, any>): Promise<void> {
    await this.loadData(data)
  }

  /**
   * Execute the full ETL process
   * @param ids Optional record of IDs to fetch specific resources
   * @returns The transformed data
   */
  protected async executeETL(ids: Record<string, Array<Record<string, any>>> = {}): Promise<Record<string, any>> {
    const data = await this.extractData(ids)
    const transformedData = this.transformData(data)
    await this.loadData(transformedData)
    return transformedData
  }

  /**
   * Extract data from source system based on configuration
   * @param ids Optional record of IDs to fetch specific resources
   * @returns Record containing extracted data
   */
  protected async extractData(
    ids: Record<string, Array<Record<string, any>>> = {},
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {
      source: this.config.name,
    }

    const { endpoints, fetchType } = this.determineEndpointsAndFetchType(ids)

    for (const endpoint of endpoints) {
      const rawPath = this.getEndpointRawPath(endpoint, fetchType)

      if (!rawPath) {
        console.warn(`No ${fetchType} path for ${endpoint}`)
        continue
      }

      if (!rawPath.includes('{')) {
        await this.processSimpleGetRequest(rawPath, endpoint, data)
        continue
      }

      await this.processParameterizedGetRequest(rawPath, endpoint, fetchType, ids, data)
    }

    return data
  }

  /**
   * Transform data according to mapping rules
   * @param data The data to transform
   * @returns Transformed data
   */
  protected transformData(data: Record<string, any>): Record<string, any> {
    // Create a compatible config object for applySourceControlInfo
    const etlCompatConfig = {
      ...this.config,
      direction: this.direction,
      integration: this.integration,
      throttleCap: this.throttleCap,
      endpointSet: this.endpointSet,
      offsets: this.offsets,
    }

    const transformedData = applySourceControlInfo(data, etlCompatConfig as any)

    // Apply overrides if available in the config
    if (this.config.type === 'api' && 'overrides' in this.config) {
      const apiConfig = this.config as any // Type assertion to access overrides
      if (apiConfig.overrides) {
        this.applyConfigOverrides(transformedData, apiConfig.overrides)
      }
    }

    return transformedData
  }

  /**
   * Load data to target endpoints
   * @param data The data to load
   */
  protected async loadData(data: Record<string, any>): Promise<void> {
    this.validateDataAgainstConfig(data)

    if (!this.config.target || Object.keys(this.config.target).length === 0) {
      console.warn('No target configuration found. Skipping load operation.')
      return
    }

    const options: RequestOptions = {}
    const requestPromises: Array<{ url: string, options: RequestOptions }> = []
    const multiBulkData: Record<string, any[]> = {}

    // Get multi-target configuration
    const multiTarget = (this.config as any).multi_target

    // Process each endpoint's data
    for (const endpoint of Object.keys(data)) {
      if (endpoint === 'source') {
        continue
      }

      if (!this.config.target[endpoint]) {
        console.error(`Data found for [${endpoint}] but no target configuration exists.`)
        continue
      }

      const bulkData = this.processEndpointData({
        endpoint,
        data,
        multiTarget: !!multiTarget,
        requestPromises,
      })

      if (multiTarget && validateBulkData(bulkData)) {
        multiBulkData[endpoint] = bulkData
      }
      else if (!multiTarget && validateBulkData(bulkData)) {
        this.handleEndpointBulkData({
          endpoint,
          bulkData,
          options,
          requestPromises,
        })
      }
    }

    // Process multi-target bulk data if available
    if (multiTarget && validateMultiBulkData(multiBulkData)) {
      this.processMultiTargetBulkData({
        multiBulkData,
        multiTarget,
        data,
        requestPromises,
      })
    }

    // Process all requests in batches
    if (requestPromises.length > 0) {
      await processBatches(
        requestPromises,
        this.throttleCap,
        async (batch) => {
          const responses = await Promise.all(
            batch.map(request => apiClient.processPostRequest(
              this.config as any,
              request.url,
              request.options,
            )),
          )
          return responses.filter(Boolean) as any[]
        },
      )
    }
  }

  /**
   * Determines the endpoints and fetch type based on configuration and provided IDs
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

    return {
      endpoints: this.endpointSet,
      fetchType: 'index',
    }
  }

  /**
   * Gets the appropriate raw path for an endpoint based on fetch type
   * @param endpoint The endpoint name
   * @param fetchType The fetch type ('index' or 'get')
   * @returns The raw path or undefined if not found
   */
  private getEndpointRawPath(
    endpoint: string,
    fetchType: 'index' | 'get',
  ): string | undefined {
    if (this.config.type === 'api' && this.config.source && endpoint in this.config.source) {
      const endpointConfig = this.config.source[endpoint]
      if ('endpoints' in endpointConfig) {
        return fetchType === 'index'
          ? endpointConfig.endpoints?.index?.path
          : endpointConfig.endpoints?.get?.path
      }
    }
    return undefined
  }

  /**
   * Process a simple GET request without parameters
   * @param rawPath The raw path to use
   * @param endpoint The endpoint name
   * @param data The data container to add processed data to
   */
  private async processSimpleGetRequest(
    rawPath: string,
    endpoint: string,
    data: Record<string, any>,
  ): Promise<void> {
    // Create a compatible config object for API client methods
    const etlCompatConfig = {
      ...this.config,
      direction: this.direction,
      integration: this.integration,
      throttleCap: this.throttleCap,
      endpointSet: this.endpointSet,
      offsets: this.offsets,
    }

    const url = apiClient.buildUrl(etlCompatConfig as any, rawPath)

    const response = await apiClient.processGetRequest(etlCompatConfig as any, url, {}, endpoint)

    if (response) {
      processResponseData(response, etlCompatConfig as any, data)
    }
    else {
      console.warn(`Skipping processing for ${url} due to failed request`)
    }
  }

  /**
   * Process a parameterized GET request with substitution keys
   * @param rawPath The raw path to use
   * @param endpoint The endpoint name
   * @param fetchType The fetch type ('index' or 'get')
   * @param ids Optional record of IDs to fetch specific resources
   * @param data The data container to add processed data to
   */
  private async processParameterizedGetRequest(
    rawPath: string,
    endpoint: string,
    fetchType: 'index' | 'get',
    ids: Record<string, Array<Record<string, any>>>,
    data: Record<string, any>,
  ): Promise<void> {
    // Create a compatible config object for API client methods
    const etlCompatConfig = {
      ...this.config,
      direction: this.direction,
      integration: this.integration,
      throttleCap: this.throttleCap,
      endpointSet: this.endpointSet,
      offsets: this.offsets,
    }

    const urls = apiClient.buildUrls(
      etlCompatConfig as any,
      rawPath,
      data,
      endpoint,
      fetchType,
      ids,
    )

    const requestPromises = urls.map(url => apiClient.processGetRequest(etlCompatConfig as any, url, {}, endpoint))

    const responses = await Promise.all(requestPromises)

    const validResponses = responses.filter(response => response !== null) as ResponseData[]

    if (validResponses.length > 0) {
      for (const response of validResponses) {
        processResponseData(response, etlCompatConfig as any, data)
      }

      console.warn(`Processed ${validResponses.length} responses with concurrency 1`)
    }

    if (validResponses.length < responses.length) {
      console.warn(`${responses.length - validResponses.length} out of ${responses.length} requests failed and were skipped`)
    }
  }

  /**
   * Apply overrides to a specific data type
   * @param dataPoints Array of data points to apply overrides to
   * @param overrides The overrides to apply
   */
  private applyOverridesToDataType(
    dataPoints: any[],
    overrides: Record<string, any>,
  ): void {
    for (const dataPoint of dataPoints) {
      for (const [key, value] of Object.entries(overrides)) {
        dataPoint[key] = value
      }
    }
  }

  /**
   * Apply all configured overrides to transformed data
   * @param transformedData The data to apply overrides to
   * @param overrides The override configuration
   */
  private applyConfigOverrides(
    transformedData: Record<string, any>,
    overrides: Record<string, Record<string, any>>,
  ): void {
    for (const [dataType, dataPoints] of Object.entries(transformedData)) {
      if (Array.isArray(dataPoints) && overrides[dataType]) {
        this.applyOverridesToDataType(dataPoints, overrides[dataType])
      }
    }
  }

  /**
   * Validates required keys for a data point
   * @param datapoint The data point to validate
   * @param requiredKeys Array of required key names
   * @returns Object with validation result and missing keys
   */
  private validateRequiredKeys(datapoint: Record<string, any>, requiredKeys: string[]): { isValid: boolean, missingKeys: string[] } {
    const missingKeys: string[] = []

    for (const key of requiredKeys) {
      if (!datapoint[key]) {
        missingKeys.push(key)
      }
    }

    return { isValid: missingKeys.length === 0, missingKeys }
  }

  /**
   * Process substitutions in a URL path
   * @param url The URL to process
   * @param rawPath The raw path with potential substitutions
   * @param datapoint The data point containing substitution values
   * @returns Object with processed URL and success status
   */
  private processUrlSubstitutions(url: string, rawPath: string | undefined, datapoint: Record<string, any>): { url: string, success: boolean } {
    if (!rawPath?.includes('{')) {
      return { url, success: true }
    }

    const keys = findSubstitutionKeys(rawPath)
    let processedUrl = url

    for (const key of keys) {
      if (datapoint[key]) {
        processedUrl = bracketSubstitution(processedUrl, key, datapoint[key])
      }
      else {
        console.error(`Missing key [${key}] for data point: ${JSON.stringify(datapoint)}`)
        return { url: processedUrl, success: false }
      }
    }

    return { url: processedUrl, success: true }
  }

  /**
   * Process an update operation for a data point
   * @param endpoint The target endpoint name
   * @param datapoint The data point to process
   * @param options The request options
   * @param requestPromises The array to collect request promises
   * @returns True if processing was successful, false otherwise
   */
  private processUpdateOperation(
    endpoint: string,
    datapoint: Record<string, any>,
    options: RequestOptions,
    requestPromises: Array<{ url: string, options: RequestOptions }>,
  ): boolean {
    // Use config directly instead of typeConfig
    const configAny = this.config as any
    const target = configAny.target || {}
    const endpointConfig = target[endpoint] || {}
    const endpoints = endpointConfig.endpoints || {}
    const updateEndpoint = endpoints.update || {}

    const rawPath = updateEndpoint.path
    const dataKey = updateEndpoint.data_key
    
    // Use precomputed URL if available, otherwise build it
    let url: string
    if (this.targetUrls[endpoint]?.update) {
      url = this.targetUrls[endpoint].update
    } else {
      url = this.buildEndpointUrl(rawPath)
    }

    const requiredKeys = updateEndpoint.required_keys || []
    const { isValid, missingKeys } = this.validateRequiredKeys(datapoint, requiredKeys)

    if (!isValid) {
      console.error(
        `Update record missing required keys: (${JSON.stringify(missingKeys)}) for data point: ${JSON.stringify(datapoint)}`,
      )
      return false
    }

    const { url: processedUrl, success } = this.processUrlSubstitutions(url, rawPath, datapoint)
    if (!success) {
      return false
    }

    const requestData = dataUtils.buildRequestData(dataKey || '', {}, datapoint)

    requestPromises.push({
      url: processedUrl,
      options: { ...options, data: requestData },
    })

    return true
  }

  /**
   * Process a bulk creation operation for a data point
   * @param endpoint The target endpoint name
   * @param datapoint The data point to process
   * @param data The full data object containing all records
   * @param bulkData The array to collect bulk data
   */
  private processBulkCreation(
    endpoint: string,
    datapoint: Record<string, any>,
    data: Record<string, any>,
    bulkData: any[],
  ): void {
    // Use config directly instead of typeConfig
    const configAny = this.config as any
    const target = configAny.target || {}
    const endpointConfig = target[endpoint] || {}
    const endpoints = endpointConfig.endpoints || {}
    const createEndpoint = endpoints.create || {}

    if (createEndpoint.include_source) {
      datapoint.source = datapoint.source ?? data.source
    }

    bulkData.push(datapoint)
  }

  /**
   * Process a file upload for a data point
   * @param filePath Path to the file to upload
   * @returns Form data object or null if file doesn't exist
   */
  private processFileUpload(filePath: string): FormData | null {
    if (!fs.existsSync(filePath)) {
      console.error(`File ${filePath} does not exist. Skipping...`)
      return null
    }

    const form = new FormData()
    const stats = fs.statSync(filePath)
    const fileSizeInBytes = stats.size
    const fileStream = fs.createReadStream(filePath)

    form.append('file', fileStream, { knownLength: fileSizeInBytes })
    return form
  }

  /**
   * Process an individual creation operation for a data point
   * @param endpoint The target endpoint name
   * @param datapoint The data point to process
   * @param payloadKey The payload key for file uploads
   * @param options The request options
   * @param requestPromises The array to collect request promises
   * @returns True if processing was successful, false otherwise
   */
  private processIndividualCreation(
    endpoint: string,
    datapoint: Record<string, any>,
    payloadKey: string | undefined,
    options: RequestOptions,
    requestPromises: Array<{ url: string, options: RequestOptions }>,
  ): boolean {
    // Use config directly instead of typeConfig
    const configAny = this.config as any
    const target = configAny.target || {}
    const endpointConfig = target[endpoint] || {}
    const endpoints = endpointConfig.endpoints || {}
    const createEndpoint = endpoints.create || {}

    const rawPath = createEndpoint.single_path
    const dataKey = createEndpoint.data_key

    if (!rawPath) {
      console.error(`No single_path defined for ${endpoint}`)
      return false
    }

    // Use precomputed URL if available, otherwise build it
    let url: string
    if (this.targetUrls[endpoint]?.create) {
      url = this.targetUrls[endpoint].create
    } else {
      url = this.buildEndpointUrl(rawPath)
    }

    // Handle file uploads if payload_key is specified
    if (payloadKey && datapoint[payloadKey]) {
      const form = this.processFileUpload(datapoint[payloadKey])
      if (!form) {
        return false
      }

      requestPromises.push({
        url,
        options: { ...options, data: form, headers: { ...options.headers, ...form.getHeaders() } },
      })

      return true
    }

    const requestData = dataUtils.buildRequestData(dataKey || '', {}, datapoint)

    requestPromises.push({
      url,
      options: { ...options, data: requestData },
    })

    return true
  }

  /**
   * Process a single data point for loading
   * @param endpoint The target endpoint name
   * @param datapoint The data point to process
   * @param updateKey The update key for identifying existing records
   * @param payloadKey The payload key for file uploads
   * @param options The request options
   * @param data The full data object containing all records
   * @param bulkData The array to collect bulk data
   * @param multiTarget Whether multi-target is enabled
   * @param requestPromises The array to collect request promises
   */
  private processDataPoint(
    endpoint: string,
    datapoint: Record<string, any>,
    updateKey: string | undefined,
    payloadKey: string | undefined,
    options: RequestOptions,
    data: Record<string, any>,
    bulkData: any[],
    multiTarget: boolean | undefined,
    requestPromises: Array<{ url: string, options: RequestOptions }>,
  ): void {
    // Skip processing if datapoint is not an object
    if (typeof datapoint !== 'object' || datapoint === null) {
      console.warn(`Skipping non-object datapoint: ${datapoint}`)
      return
    }

    // Process update operation if update key is present in datapoint
    if (updateKey && datapoint[updateKey]) {
      const success = this.processUpdateOperation(endpoint, datapoint, options, requestPromises)
      if (success) {
        return
      }
    }

    // Process bulk creation if multi-target is enabled
    if (multiTarget) {
      this.processBulkCreation(endpoint, datapoint, data, bulkData)
      return
    }

    // Process individual creation
    const configAny = this.config as any
    const target = configAny.target || {}
    const endpointConfig = target[endpoint] || {}
    const endpoints = endpointConfig.endpoints || {}
    const createEndpoint = endpoints.create || {}

    // If bulk_path is defined, collect for bulk processing
    if (createEndpoint.bulk_path) {
      this.processBulkCreation(endpoint, datapoint, data, bulkData)
      return
    }

    // Otherwise process individual creation
    this.processIndividualCreation(endpoint, datapoint, payloadKey, options, requestPromises)
  }

  /**
   * Validates data against the configuration and logs errors for missing endpoints
   * @param data The data to validate
   */
  private validateDataAgainstConfig(data: Record<string, any>): void {
    if (!this.config.target) {
      return
    }

    for (const key of Object.keys(data)) {
      if (key === 'source') {
        continue
      }

      if (!this.config.target[key]) {
        console.error(`Data found for [${key}] but no target configuration exists.`)
      }
    }
  }

  /**
   * Processes a single endpoint's data points
   * @param params Object containing processing parameters
   * @param params.endpoint The target endpoint name
   * @param params.data The full data object containing all records
   * @param params.multiTarget Whether multi-target is enabled
   * @param params.requestPromises The array to collect request promises
   * @returns Bulk data collected during processing
   */
  private processEndpointData({
    endpoint,
    data,
    multiTarget,
    requestPromises,
  }: {
    endpoint: string
    data: Record<string, any>
    multiTarget: boolean | undefined
    requestPromises: Array<{ url: string, options: RequestOptions }>
  }): any[] {
    const bulkData: any[] = []
    const options: RequestOptions = {}

    // Use config directly instead of typeConfig
    const configAny = this.config as any
    const target = configAny.target || {}
    const endpointConfig = target[endpoint] || {}
    const endpoints = endpointConfig.endpoints || {}
    const updateEndpoint = endpoints.update || {}
    const createEndpoint = endpoints.create || {}

    const updateKey = updateEndpoint.update_key
    const payloadKey = createEndpoint.payload_key

    const dataPoints = data[endpoint]

    if (!Array.isArray(dataPoints)) {
      console.warn(`Data for ${endpoint} is not an array. Skipping...`)
      return bulkData
    }

    for (const datapoint of dataPoints) {
      this.processDataPoint(
        endpoint,
        datapoint,
        updateKey,
        payloadKey,
        options,
        data,
        bulkData,
        multiTarget,
        requestPromises,
      )
    }

    return bulkData
  }

  /**
   * Handles bulk data for a specific endpoint
   * @param params Object containing bulk data parameters
   * @param params.endpoint The target endpoint name
   * @param params.bulkData The array of bulk data to process
   * @param params.options The request options
   * @param params.requestPromises The array to collect request promises
   */
  private handleEndpointBulkData({
    endpoint,
    bulkData,
    options,
    requestPromises,
  }: {
    endpoint: string
    bulkData: any[]
    options: RequestOptions
    requestPromises: Array<{ url: string, options: RequestOptions }>
  }): void {
    // Use config directly instead of typeConfig
    const configAny = this.config as any
    const target = configAny.target || {}
    const endpointConfig = target[endpoint] || {}
    const endpoints = endpointConfig.endpoints || {}
    const createEndpoint = endpoints.create || {}

    const rawPath = createEndpoint.bulk_path
    const dataKey = createEndpoint.data_key

    if (!rawPath) {
      console.error(`No bulk_path defined for ${endpoint}`)
      return
    }

    let url: string
    if (this.targetUrls[endpoint]?.bulk) {
      url = this.targetUrls[endpoint].bulk
    }
    else {
      url = this.buildEndpointUrl(rawPath)
    }
    const requestData = dataUtils.buildRequestData(dataKey || '', {}, bulkData)

    requestPromises.push({
      url,
      options: { ...options, data: requestData },
    })
  }

  /**
   * Processes multi-target bulk data
   * @param params Object containing multi-target bulk data parameters
   * @param params.multiBulkData The record containing bulk data for each endpoint
   * @param params.multiTarget The multi-target configuration
   * @param params.data The full data object containing all records
   * @param params.requestPromises The array to collect request promises
   */
  private processMultiTargetBulkData({
    multiBulkData,
    multiTarget,
    data,
    requestPromises,
  }: {
    multiBulkData: Record<string, any[]>
    multiTarget: NonNullable<any>
    data: Record<string, any>
    requestPromises: Array<{ url: string, options: RequestOptions }>
  }): void {
    const options: RequestOptions = {}
    const dataKey = multiTarget.data_key
    const includeSource = multiTarget.include_source

    // Use precomputed URL if available, otherwise build it
    let url: string
    if (this.targetUrls.multi_target?.path) {
      url = this.targetUrls.multi_target.path
    }
    else if (multiTarget.path) {
      url = this.buildEndpointUrl(multiTarget.path)
    }
    else {
      console.error('No path defined for multi_target')
      return
    }

    const allData: any[] = []

    for (const [endpoint, bulkData] of Object.entries(multiBulkData)) {
      for (const item of bulkData) {
        const processedItem = { ...item, type: endpoint }

        if (includeSource) {
          processedItem.source = processedItem.source ?? data.source
        }

        allData.push(processedItem)
      }
    }

    const requestData = dataUtils.buildRequestData(dataKey || '', {}, allData)

    requestPromises.push({
      url,
      options: { ...options, data: requestData },
    })
  }

  /**
   * Builds a URL for endpoint operations
   * @param endpointPath The specific endpoint path
   * @returns The constructed URL
   */
  protected buildEndpointUrl(endpointPath: string | undefined): string {
    return (this.baseUrl || '') + (endpointPath || '')
  }
}

/**
 * Validates if the bulk data array is empty
 * @param bulkData The array of bulk data to validate
 * @returns True if the data is valid (not empty), false otherwise
 */
function validateBulkData(bulkData: any[]): boolean {
  return bulkData.length > 0
}

/**
 * Validates if the multi-target bulk data object is empty
 * @param multiBulkData The record containing bulk data for each endpoint
 * @returns True if the data is valid (not empty), false otherwise
 */
function validateMultiBulkData(multiBulkData: Record<string, any[]>): boolean {
  return Object.keys(multiBulkData).length > 0
}
