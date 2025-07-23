import type { ResponseData } from '../services/api-client'
import type { ETLConfig } from '../utils/etl-types'
import type { RequestOptions } from '../utils/network'
import * as fs from 'node:fs'
import FormData from 'form-data'
import { apiClient } from '../services/api-client'
import { applySourceControlInfo, processBatches, processResponseData } from '../utils/batch-processor'
import * as dataUtils from '../utils/data'
import { bracketSubstitution, findSubstitutionKeys } from '../utils/enhanced-config-loader'

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

/**
 * Builds a URL for endpoint operations
 * @param config The endpoint configuration
 * @param endpointPath The specific endpoint path
 * @returns The constructed URL
 */
function buildEndpointUrl(config: ETLConfig, endpointPath: string | undefined): string {
  const configAny = config as any
  return (config.baseUrl || '') + (configAny.base_path || '') + (endpointPath || '')
}

const TARGET_CONCURRENCY = 5

/**
 * Determines the endpoints and fetch type based on configuration and provided IDs
 * @param config The endpoint configuration
 * @param ids Optional record of IDs to fetch specific resources
 * @returns Object containing endpoints and fetch type
 */
function determineEndpointsAndFetchType(
  config: ETLConfig,
  ids: Record<string, Array<Record<string, any>>> = {},
): { endpoints: string[], fetchType: 'index' | 'get' } {
  if (Object.keys(ids).length > 0) {
    return {
      endpoints: Object.keys(ids),
      fetchType: 'get',
    }
  }

  return {
    endpoints: config.endpointSet,
    fetchType: 'index',
  }
}

/**
 * Gets the appropriate raw path for an endpoint based on fetch type
 * @param config The endpoint configuration
 * @param endpoint The endpoint name
 * @param fetchType The fetch type ('index' or 'get')
 * @returns The raw path or undefined if not found
 */
function getEndpointRawPath(
  config: ETLConfig,
  endpoint: string,
  fetchType: 'index' | 'get',
): string | undefined {
  return fetchType === 'index'
    ? config.typeConfig?.source?.[endpoint]?.endpoints?.index?.path
    : config.typeConfig?.source?.[endpoint]?.endpoints?.get?.path
}

/**
 * Process a simple GET request without parameters
 * @param config The endpoint configuration
 * @param rawPath The raw path to use
 * @param endpoint The endpoint name
 * @param data The data container to add processed data to
 */
async function processSimpleGetRequest(
  config: ETLConfig,
  rawPath: string,
  endpoint: string,
  data: Record<string, any>,
): Promise<void> {
  const url = apiClient.buildUrl(config as any, rawPath)

  const response = await apiClient.processGetRequest(config as any, url, {}, endpoint)

  if (response) {
    processResponseData(response, config, data)
  }
  else {
    console.warn(`Skipping processing for ${url} due to failed request`)
  }
}

/**
 * Extract data from source system based on configuration
 * @param config The endpoint configuration
 * @param ids Optional record of IDs to fetch specific resources
 * @returns Record containing extracted data
 */
export async function extractData(
  config: ETLConfig,
  ids: Record<string, Array<Record<string, any>>> = {},
): Promise<Record<string, any>> {
  const data: Record<string, any> = {
    source: config.typeConfig?.name,
  }

  const { endpoints, fetchType } = determineEndpointsAndFetchType(config, ids)

  for (const endpoint of endpoints) {
    const rawPath = getEndpointRawPath(config, endpoint, fetchType)

    if (!rawPath) {
      console.warn(`No ${fetchType} path for ${endpoint}`)
      continue
    }

    if (!rawPath.includes('{')) {
      await processSimpleGetRequest(config, rawPath, endpoint, data)
      continue
    }

    await processParameterizedGetRequest(config, rawPath, endpoint, fetchType, ids, data)
  }

  return data
}

/**
 * Process a parameterized GET request with substitution keys
 * @param config The endpoint configuration
 * @param rawPath The raw path to use
 * @param endpoint The endpoint name
 * @param fetchType The fetch type ('index' or 'get')
 * @param ids Optional record of IDs to fetch specific resources
 * @param data The data container to add processed data to
 */
async function processParameterizedGetRequest(
  config: ETLConfig,
  rawPath: string,
  endpoint: string,
  fetchType: 'index' | 'get',
  ids: Record<string, Array<Record<string, any>>>,
  data: Record<string, any>,
): Promise<void> {
  const urls = apiClient.buildUrls(
    config as any,
    rawPath,
    data,
    endpoint,
    fetchType,
    ids,
  )

  const requestPromises = urls.map(url => apiClient.processGetRequest(config as any, url, {}, endpoint))

  const responses = await Promise.all(requestPromises)

  const validResponses = responses.filter(response => response !== null) as ResponseData[]

  if (validResponses.length > 0) {
    for (const response of validResponses) {
      processResponseData(response, config, data)
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
function applyOverridesToDataType(
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
function applyConfigOverrides(
  transformedData: Record<string, any>,
  overrides: Record<string, Record<string, any>>,
): void {
  for (const [dataType, dataPoints] of Object.entries(transformedData)) {
    if (Array.isArray(dataPoints) && overrides[dataType]) {
      applyOverridesToDataType(dataPoints, overrides[dataType])
    }
  }
}

/**
 * Transform data according to mapping rules
 * @param config The endpoint configuration
 * @param data The data to transform
 * @returns Transformed data
 */
export function transformData(
  config: ETLConfig,
  data: Record<string, any>,
): Record<string, any> {
  const transformedData = applySourceControlInfo(data, config)

  if (config.typeConfig?.overrides) {
    applyConfigOverrides(transformedData, config.typeConfig.overrides)
  }

  return transformedData
}

/**
 * Validates required keys for a data point
 * @param datapoint The data point to validate
 * @param requiredKeys Array of required key names
 * @returns Object with validation result and missing keys
 */
function validateRequiredKeys(datapoint: Record<string, any>, requiredKeys: string[]): { isValid: boolean, missingKeys: string[] } {
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
function processUrlSubstitutions(url: string, rawPath: string | undefined, datapoint: Record<string, any>): { url: string, success: boolean } {
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
 * @param params Processing parameters
 * @param params.config The endpoint configuration
 * @param params.endpoint The target endpoint name
 * @param params.datapoint The data point to process
 * @param params.options The request options
 * @param params.requestPromises The array to collect request promises
 * @returns True if processing was successful, false otherwise
 */
function processUpdateOperation(params: {
  config: ETLConfig
  endpoint: string
  datapoint: Record<string, any>
  options: RequestOptions
  requestPromises: Array<{ url: string, options: RequestOptions }>
}): boolean {
  const { config, endpoint, datapoint, options, requestPromises } = params

  // Use config directly instead of typeConfig
  const configAny = config as any
  const target = configAny.target || {}
  const endpointConfig = target[endpoint] || {}
  const endpoints = endpointConfig.endpoints || {}
  const updateEndpoint = endpoints.update || {}

  const rawPath = updateEndpoint.path
  const dataKey = updateEndpoint.data_key
  const url = buildEndpointUrl(config, rawPath)

  const requiredKeys = updateEndpoint.required_keys || []
  const { isValid, missingKeys } = validateRequiredKeys(datapoint, requiredKeys)

  if (!isValid) {
    console.error(
      `Update record missing required keys: (${JSON.stringify(missingKeys)}) for data point: ${JSON.stringify(datapoint)}`,
    )
    return false
  }

  const { url: processedUrl, success } = processUrlSubstitutions(url, rawPath, datapoint)
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
 * @param params Processing parameters
 * @param params.config The endpoint configuration
 * @param params.endpoint The target endpoint name
 * @param params.datapoint The data point to process
 * @param params.data The full data object containing all records
 * @param params.bulkData The array to collect bulk data
 */
function processBulkCreation(params: {
  config: ETLConfig
  endpoint: string
  datapoint: Record<string, any>
  data: Record<string, any>
  bulkData: any[]
}): void {
  const { config, endpoint, datapoint, data, bulkData } = params

  // Use config directly instead of typeConfig
  const configAny = config as any
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
function processFileUpload(filePath: string): FormData | null {
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
 * @param params Processing parameters
 * @param params.config The endpoint configuration
 * @param params.endpoint The target endpoint name
 * @param params.datapoint The data point to process
 * @param params.payloadKey The payload key for file uploads
 * @param params.options The request options
 * @param params.requestPromises The array to collect request promises
 * @returns True if processing was successful, false otherwise
 */
function processIndividualCreation(params: {
  config: ETLConfig
  endpoint: string
  datapoint: Record<string, any>
  payloadKey: string | undefined
  options: RequestOptions
  requestPromises: Array<{ url: string, options: RequestOptions }>
}): boolean {
  const { config, endpoint, datapoint, payloadKey, options, requestPromises } = params

  // Use config directly instead of typeConfig
  const configAny = config as any
  const target = configAny.target || {}
  const endpointConfig = target[endpoint] || {}
  const endpoints = endpointConfig.endpoints || {}
  const createEndpoint = endpoints.create || {}

  const rawPath = createEndpoint.single_path
  const dataKey = createEndpoint.data_key || ''
  const url = buildEndpointUrl(config, rawPath)

  let requestData: any

  if (payloadKey && datapoint?.[payloadKey]) {
    const form = processFileUpload(datapoint[payloadKey])
    if (!form) {
      return false
    }
    requestData = form
  }
  else {
    requestData = dataUtils.buildRequestData(dataKey, {}, datapoint)
  }

  requestPromises.push({
    url,
    options: { ...options, data: requestData },
  })

  return true
}

/**
 * Process a single data point for loading
 * @param params Processing parameters object
 * @param params.config The endpoint configuration
 * @param params.endpoint The target endpoint name
 * @param params.datapoint The data point to process
 * @param params.updateKey The update key for identifying existing records
 * @param params.payloadKey The payload key for file uploads
 * @param params.options The request options
 * @param params.data The full data object containing all records
 * @param params.bulkData The array to collect bulk data
 * @param params.multiTarget Whether multi-target is enabled
 * @param params.requestPromises The array to collect request promises
 */
function processDataPoint(params: {
  config: ETLConfig
  endpoint: string
  datapoint: Record<string, any>
  updateKey: string | undefined
  payloadKey: string | undefined
  options: RequestOptions
  data: Record<string, any>
  bulkData: any[]
  multiTarget: boolean | undefined
  requestPromises: Array<{ url: string, options: RequestOptions }>
}): void {
  const { config, endpoint, datapoint, updateKey, payloadKey, options, data, bulkData, multiTarget } = params
  const configAny = config as any
  const target = configAny.target || {}
  const endpointConfig = target[endpoint] || {}
  const endpoints = endpointConfig.endpoints || {}
  const createEndpoint = endpoints.create || {}

  if (updateKey && datapoint?.[updateKey]) {
    processUpdateOperation({
      config,
      endpoint,
      datapoint,
      options,
      requestPromises: params.requestPromises,
    })
  }
  else if (createEndpoint.bulk_path || multiTarget) {
    processBulkCreation({
      config,
      endpoint,
      datapoint,
      data,
      bulkData,
    })
  }
  else {
    processIndividualCreation({
      config,
      endpoint,
      datapoint,
      payloadKey,
      options,
      requestPromises: params.requestPromises,
    })
  }
}

/**
 * Validates data against the configuration and logs errors for missing endpoints
 * @param data The data to validate
 * @param config The endpoint configuration
 */
function validateDataAgainstConfig(
  data: Record<string, any>,
  config: ETLConfig,
): void {
  for (const dataEndpoint of Object.keys(data)) {
    if (dataEndpoint !== 'source' && !config.endpointSet.includes(dataEndpoint)) {
      const configAny = config as any
      console.error(
        `Data found for [${dataEndpoint}], but no configuration `
        + `for this data type exists for target [${configAny.name}] so the data `
        + 'will be dropped.',
      )
    }
  }
}

/**
 * Processes a single endpoint's data points
 * @param params Processing parameters object
 * @param params.config The endpoint configuration
 * @param params.endpoint The target endpoint name
 * @param params.data The full data object containing all records
 * @param params.multiTarget Whether multi-target is enabled
 * @param params.requestPromises The array to collect request promises
 * @returns Bulk data collected during processing
 */
function processEndpointData(params: {
  config: ETLConfig
  endpoint: string
  data: Record<string, any>
  multiTarget: boolean | undefined
  requestPromises: Array<{ url: string, options: RequestOptions }>
}): any[] {
  const { config, endpoint, data, multiTarget, requestPromises } = params
  const bulkData: any[] = []

  if (!data[endpoint] || !Array.isArray(data[endpoint])) {
    return bulkData
  }

  // Use config directly instead of typeConfig
  const configAny = config as any
  const target = configAny.target || {}
  const endpointConfig = target[endpoint] || {}
  const endpoints = endpointConfig.endpoints || {}
  const updateEndpoint = endpoints.update || {}
  const createEndpoint = endpoints.create || {}

  const updateKey = updateEndpoint.update_key || undefined
  const payloadKey = createEndpoint.payload_key || undefined
  const options = {}

  for (const datapoint of data[endpoint]) {
    processDataPoint({
      config,
      endpoint,
      datapoint,
      updateKey,
      payloadKey,
      options,
      data,
      bulkData,
      multiTarget,
      requestPromises,
    })
  }

  return bulkData
}

/**
 * Handles bulk data for a specific endpoint
 * @param params Processing parameters object
 * @param params.config The endpoint configuration
 * @param params.endpoint The target endpoint name
 * @param params.bulkData The array of bulk data to process
 * @param params.options The request options
 * @param params.requestPromises The array to collect request promises
 */
function handleEndpointBulkData(params: {
  config: ETLConfig
  endpoint: string
  bulkData: any[]
  options: RequestOptions
  requestPromises: Array<{ url: string, options: RequestOptions }>
}): void {
  const { config, endpoint, bulkData, options, requestPromises } = params

  if (!validateBulkData(bulkData)) {
    return
  }

  // Use config directly instead of typeConfig
  const configAny = config as any
  const target = configAny.target || {}
  const endpointConfig = target[endpoint] || {}
  const endpoints = endpointConfig.endpoints || {}
  const createEndpoint = endpoints.create || {}

  const rawPath = createEndpoint.bulk_path
  const dataKey = createEndpoint.data_key || ''
  const url = buildEndpointUrl(config, rawPath)

  const requestData = dataUtils.buildRequestData(dataKey, {}, bulkData)

  const requestOptions = { ...options, data: requestData }

  requestPromises.push({ url, options: requestOptions })
}

/**
 * Processes multi-target bulk data
 * @param params Processing parameters object
 * @param params.config The endpoint configuration
 * @param params.multiBulkData The record containing bulk data for each endpoint
 * @param params.multiTarget The multi-target configuration
 * @param params.data The full data object containing all records
 * @param params.requestPromises The array to collect request promises
 */
function processMultiTargetBulkData(params: {
  config: ETLConfig
  multiBulkData: Record<string, any[]>
  multiTarget: NonNullable<any>
  data: Record<string, any>
  requestPromises: Array<{ url: string, options: RequestOptions }>
}): void {
  const { config, multiBulkData, multiTarget, data, requestPromises } = params

  if (!validateMultiBulkData(multiBulkData)) {
    return
  }

  const rawPath = multiTarget.path
  const dataKey = multiTarget.data_key || ''
  const url = buildEndpointUrl(config, rawPath)

  const options = {}

  const allData: any[] = Object.keys(multiBulkData).flatMap((endpoint) => {
    return multiBulkData[endpoint].map((datapoint: Record<string, any>) => {
      if (multiTarget.include_source) {
        datapoint.source = datapoint.source ?? data.source
      }
      return datapoint
    })
  })

  const requestData = dataUtils.buildRequestData(dataKey, {}, allData)

  requestPromises.push({
    url,
    options: { ...options, data: requestData },
  })
}

/**
 * Load data to target endpoints
 * @param config The endpoint configuration
 * @param allData The data to load
 * @returns Promise that resolves when all data is loaded
 */
export async function loadData(
  config: ETLConfig,
  allData: Record<string, any>,
): Promise<void> {
  const requestPromises: Array<{ url: string, options: RequestOptions }> = []
  const data = allData

  validateDataAgainstConfig(data, config)

  // Use config directly instead of typeConfig
  const configAny = config as any
  const hasMultiTarget = !!configAny.multi_target && typeof configAny.multi_target === 'object'
  const multiBulkData: Record<string, any[]> = {}

  for (const endpoint of config.endpointSet) {
    const bulkData = processEndpointData({
      config,
      endpoint,
      data,
      multiTarget: hasMultiTarget,
      requestPromises,
    })

    if (bulkData.length > 0) {
      if (hasMultiTarget) {
        if (!multiBulkData[endpoint]) {
          multiBulkData[endpoint] = []
        }
        multiBulkData[endpoint].push(...bulkData)
      }
      else {
        handleEndpointBulkData({
          config,
          endpoint,
          bulkData,
          options: {},
          requestPromises,
        })
      }
    }
  }

  if (hasMultiTarget && configAny.multi_target) {
    processMultiTargetBulkData({
      config,
      multiBulkData,
      multiTarget: configAny.multi_target,
      data,
      requestPromises,
    })
  }

  if (requestPromises.length > 0) {
    console.warn(`Processing ${requestPromises.length} requests with concurrency ${TARGET_CONCURRENCY}`)
    await processBatches<{ url: string, options: any }, any>(
      requestPromises,
      1,
      async (batch) => {
        const req = batch[0]
        const result = await apiClient.processPostRequest(config as any, req.url, req.options)
        return [result]
      },
      TARGET_CONCURRENCY,
    )
  }
}

/**
 * Execute the full ETL process
 * @param config The endpoint configuration
 * @param sourceData Optional data to use instead of extracting from source
 * @returns The transformed data
 */
export async function executeETL(
  config: ETLConfig,
  sourceData?: Record<string, any>,
): Promise<Record<string, any>> {
  const extractedData = sourceData || await extractData(config)

  const transformedData = transformData(config, extractedData)

  await loadData(config, transformedData)

  return transformedData
}
