import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import * as fs from 'node:fs'
import axios from 'axios'
import FormData from 'form-data'
import * as configUtils from '../utils/configuration'
import * as dataUtils from '../utils/data'

interface ResponseData {
  data: any
  source_type: string
  target_type: string
}

const sourceRequestsQueue: Promise<ResponseData>[] = []
const sourceThrottleCounter: number[] = []
const sourceResponseCounter: Record<string, number> = {}

const targetRequestsQueue: Promise<any>[] = []
const targetThrottleCounter: number[] = []

/* ids - an object with endpoints as keys and lists of objects with identifying
         data as values: e.g. { executions: [ { id: 1 } ] }
*/
export async function pullData(
  config: configUtils.EndpointConfig,
  ids: Record<string, Array<Record<string, any>>>,
): Promise<Record<string, any>> {
  // config.progressBar.start(200, 0);

  // Pull data
  const data: Record<string, any> = {
    source: config.typeConfig?.name,
  }
  let endpoints: string[] = []
  let fetchType: 'index' | 'get' = 'index'

  if (Object.keys(ids).length > 0) {
    // This means we're doing individual 'gets'.
    endpoints = Object.keys(ids)
    fetchType = 'get'
  }
  else {
    // Pull our preconstructed endpoint set.
    endpoints = config.endpointSet
  }

  for (const endpoint of endpoints) {
    const rawPath = (
      fetchType === 'index'
        ? config.typeConfig?.source?.[endpoint]?.endpoints?.index?.path
        : config.typeConfig?.source?.[endpoint]?.endpoints?.get?.path
    )
    const options: AxiosRequestConfig = {}

    // Add authn to the request
    if (config.authSchema?.location === 'header') {
      options.headers = {}
      const keys = configUtils.findSubstitutionKeys(config.authSchema.payload)
      // Loop through the replacement keys (in {}) on this endpoint
      for (const key of keys) {
        // Pull identifier
        if (options.headers && config.authSchema.key && config.authPayload) {
          options.headers[config.authSchema.key] = config.authPayload
        }
      }
    }

    if (rawPath && !rawPath.includes('{')) {
      // No keys means a simple index.
      const url = (config.baseUrl || '')
        + (config.typeConfig?.base_path || '')
        + rawPath

      sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint))
    }
    else if (rawPath) {
      const unsortedKeys = configUtils.findSubstitutionKeys(rawPath)
      const denormalizedConfigKeys = config.typeConfig?.denormalized_keys?.[endpoint] || {}
      let keys: string[] = []

      if (Object.keys(denormalizedConfigKeys).length < 1) {
        keys = unsortedKeys
      }
      else {
        // Move our denormalized keys to the front of the line for URL building
        for (let i = Object.keys(denormalizedConfigKeys).length - 1; i > -1; i--) {
          for (const key of unsortedKeys) {
            if (key.includes(Object.keys(denormalizedConfigKeys)[i])) {
              keys.unshift(key)
            }
            else {
              keys.push(key)
            }
          }
        }
      }

      const urlList: string[] = []
      urlList.push((config.baseUrl || '')
        + (config.typeConfig?.base_path || '')
        + rawPath)

      if (fetchType === 'index') {
        // Loop through the replacement keys (in {}) on this endpoint
        for (const key of keys) {
          // Pull the entity type of the key
          const splitKey = key.split('.')
          const refEndpoint = splitKey[0] // i.e. the "projects" in "projects.id"
          const refLocation = (
            splitKey[1] && splitKey[1] !== 'id'
              ? splitKey[1]
              : 'source_id'
          )

          if (data[refEndpoint]) {
            for (let i = urlList.length - 1; i > -1; i--) {
              const url = urlList[i]
              // Loop through our source data to find ids for child paths
              for (const record of data[refEndpoint]) {
                // Build path and push

                // For odd case around denormalized APIs like TR's "test cases"
                if (config.typeConfig?.denormalized_keys?.[endpoint]
                  && (refEndpoint
                    in (config.typeConfig.denormalized_keys[endpoint] || {}))) {
                  for (const fullDenormKey in
                    config.typeConfig.denormalized_keys?.[endpoint]?.[refEndpoint]) {
                    const splitDenormKey = fullDenormKey.split('.')
                    const denormEndpoint = splitKey[0] // i.e. the "projects" in "projects.id"

                    // For poorly designed APIs, you can end up with multiple keys
                    //  that need to match.  For instance, needing to define both
                    //  the project and the suite a test belongs to (when the
                    //  suite belongs to the project as well).
                    const denormValue
                      = config.typeConfig.denormalized_keys?.[endpoint]?.[refEndpoint]?.[fullDenormKey]

                    // Look for the matching record in the second type (suites)
                    //  based on the key in the denorm keys table (project_id).
                    //  Then pull that record's refLocation for substitution.
                    for (const denormRecord of data[denormEndpoint]) {
                      if (denormValue && denormRecord?.[denormValue] === record[refLocation]) {
                        // Replace our base key before handing denorm keys.
                        let newURL = configUtils.bracketSubstitution(
                          url,
                          key,
                          denormRecord[refLocation],
                        )
                        for (const [secondaryReplacementKey, secondaryKey] of
                          Object.entries(denormalizedConfigKeys[refEndpoint] || {})) {
                          newURL = configUtils.bracketSubstitution(
                            newURL,
                            secondaryReplacementKey,
                            denormRecord?.[secondaryKey],
                          )
                          const removalIndex = keys.indexOf(secondaryReplacementKey)
                          if (removalIndex > -1) {
                            keys.splice(removalIndex, 1)
                          }
                        }
                        urlList.push(newURL)
                      }
                    }
                  }
                }
                else {
                  // Not a denormalized key
                  urlList.push(configUtils.bracketSubstitution(
                    url,
                    key,
                    record[refLocation],
                  ))
                }
              } // else continue
              // Remove the original record that has since had variables
              //  substituted.
              urlList.splice(i, 1)
            }
          }
        }
      }
      else if (fetchType === 'get') {
        for (let i = urlList.length - 1; i > -1; i--) {
          const url = urlList[i]
          for (const record of ids[endpoint]) {
            let newURL = url
            for (const [secondaryReplacementKey, secondaryKey] of
              Object.entries(record)) {
              newURL = configUtils.bracketSubstitution(
                newURL,
                secondaryReplacementKey,
                secondaryKey as string,
              )
            }
            urlList.push(newURL)
          }
          urlList.splice(i, 1)
        }
      }

      for (const url of urlList) {
        sourceRequestsQueue.push(processNetworkGetRequest(config, url, options, endpoint))
      }
    }

    // Wait for all calls to this endpoint to finish before proceding
    await Promise.all(sourceRequestsQueue).then((responses) => {
      for (let i = responses.length - 1; i >= 0; i--) {
        const response = responses[i]

        if (Array.isArray(response.data) && response.data.length < 1) {
          continue
        }
        if (!Array.isArray(response.data)) {
          response.data = [response.data]
        }
        for (const record of response.data) {
          const dataPoint = dataUtils.mapDataWithIgnores(
            config.typeConfig?.source?.[response.source_type]?.mapping || {},
            record,
            (
              config.ignoreConfig
                ? config.ignoreConfig[response.source_type]
                : {}
            ),
          )
          if (!data[response.target_type]) {
            data[response.target_type] = []
          }
          if (dataPoint) {
            data[response.target_type].push(dataPoint)
          }
        }
        sourceRequestsQueue.splice(i, 1)
      }
      // config.progressBar.update(config.sourceProgressIncrement);
    })
  }
  return data
}

export async function pushData(
  config: configUtils.EndpointConfig,
  data: Record<string, any>,
): Promise<void> {
  console.log(JSON.stringify(data, null, 2))
  // Check for any data that will be dropped and warn
  for (const dataEndpoint of Object.keys(data)) {
    if (!config.endpointSet.includes(dataEndpoint)) {
      console.error(`Data found for [${dataEndpoint}], but no configuration `
        + `for this data type exists for target [${config.typeConfig?.name}] so the data`
        + `will not be sent.`)
    }
  }

  const multiTarget = config.typeConfig?.multi_target
  const multiBulkData: Record<string, any> = {}
  for (const endpoint of config.endpointSet) {
    if (data[endpoint]) {
      const bulkData: any[] = []
      const updateKey = config.typeConfig?.target?.[endpoint]?.endpoints?.update?.update_key || undefined
      const payloadKey = config.typeConfig?.target?.[endpoint]?.endpoints?.create?.payload_key || undefined
      const options: AxiosRequestConfig = {}
      const mapping = config.typeConfig?.target?.[endpoint]?.mapping || {}

      // Add authn to the request
      if (config.authSchema?.location === 'header') {
        options.headers = {}
        const keys = configUtils.findSubstitutionKeys(config.authSchema.payload)
        // Loop through the replacement keys (in {}) on this endpoint
        for (const key of keys) {
          // Pull identifier
          if (options.headers && config.authSchema.key && config.authPayload) {
            options.headers[config.authSchema.key] = config.authPayload
          }
        }
      }

      for (const datapoint of data[endpoint]) {
        // Move keys based on mapping
        const mappedDatapoint = dataUtils.mapData(mapping, datapoint)

        if (updateKey && mappedDatapoint?.[updateKey]) {
          // Update record.
          const rawPath = config.typeConfig?.target?.[endpoint]?.endpoints?.update?.path
          const dataKey = config.typeConfig?.target?.[endpoint]?.endpoints?.update?.data_key
          let url = (config.baseUrl || '')
            + (config.typeConfig?.base_path || '')
            + (rawPath || '')
          const requiredKeys = config.typeConfig?.target?.[endpoint]?.endpoints?.update?.required_keys
            ?? []
          const missingKeys: string[] = []
          for (const rKey of requiredKeys) {
            if (!mappedDatapoint[rKey]) {
              missingKeys.push(rKey)
            }
          }
          if (missingKeys.length > 0) {
            console.error(
              `Update record missing required keys: (${
                JSON.stringify(missingKeys)
              }) for data point: ${JSON.stringify(datapoint)}`,
            )
            continue
          }
          if (rawPath?.includes('{')) {
            // Handle substitutions
            const keys = configUtils.findSubstitutionKeys(rawPath)
            for (const key of keys) {
              if (mappedDatapoint[key]) {
                url = configUtils.bracketSubstitution(
                  url,
                  key,
                  mappedDatapoint[key],
                )
              }
              else {
                console.error(
                  `Update record missing key [${key}] for data point: ${
                    JSON.stringify(datapoint)
                  }`,
                )
                continue
              }
            }
          }
          options.data = dataUtils.buildRequestData(
            dataKey || '',
            mapping,
            mappedDatapoint,
          )

          if (config.gitRepo || config.gitBranch || config.gitSha) {
            options.data.source_control = {
              repo: config.gitRepo,
              branch: config.gitBranch,
              sha: config.gitSha,
            }
          }

          // Add our override data on update
          if (config.overrides?.[endpoint]) {
            for (const [key, value] of Object.entries(config.overrides[endpoint])) {
              options.data[key] = value
            }
          }

          targetRequestsQueue.push(
            processNetworkPostRequest(config, url, options),
          )
        }
        else if (config.typeConfig?.target?.[endpoint]?.endpoints?.create?.bulk_path || multiTarget) {
          // Bulk creation

          if (config.typeConfig?.target?.[endpoint]?.endpoints?.create?.include_source) {
            // Use source from mappedDatapoint if available; fallback to data.source.
            // Helpful when pushData is used with raw JSON input.
            mappedDatapoint.source = mappedDatapoint.source ?? data.source
          }

          if (config.gitRepo || config.gitBranch || config.gitSha) {
            mappedDatapoint.source_control = {
              repo: config.gitRepo,
              branch: config.gitBranch,
              sha: config.gitSha,
            }
          }

          if (config.overrides?.[endpoint]) {
            for (const [key, value] of Object.entries(config.overrides[endpoint])) {
              mappedDatapoint[key] = value
            }
          }

          bulkData.push(mappedDatapoint)
        }
        else {
          // Individual creation
          const rawPath = config.typeConfig?.target?.[endpoint]?.endpoints?.create?.single_path
          const dataKey = config.typeConfig?.target?.[endpoint]?.endpoints?.create?.data_key || ''
          const url = (config.baseUrl || '')
            + (config.typeConfig?.base_path || '')
            + (rawPath || '')

          if (payloadKey && mappedDatapoint?.[payloadKey]) {
            // Creation with payload
            const filePath = mappedDatapoint?.[payloadKey]
            if (!fs.existsSync(filePath)) {
              console.error(`File ${filePath} does not exist. Skipping...`)
              continue
            }

            const form = new FormData()
            const stats = fs.statSync(filePath)
            const fileSizeInBytes = stats.size
            const fileStream = fs.createReadStream(filePath)

            form.append('file', fileStream, { knownLength: fileSizeInBytes })
            options.data = form
          }
          else {
            options.data = dataUtils.buildRequestData(
              dataKey,
              mapping,
              mappedDatapoint,
            )

            if (config.typeConfig?.target?.[endpoint]?.endpoints?.create?.include_source) {
              // Use source from mappedDatapoint if available; fallback to data.source.
              // Helpful when pushData is used with raw JSON input.
              options.data.source = mappedDatapoint.source ?? data.source
            }

            if (config.gitRepo || config.gitBranch || config.gitSha) {
              options.data.source_control = {
                repo: config.gitRepo,
                branch: config.gitBranch,
                sha: config.gitSha,
              }
            }

            // Add our override data on create
            if (config.overrides?.[endpoint]) {
              for (const [key, value] of Object.entries(config.overrides[endpoint])) {
                options.data[key] = value
              }
            }
          }

          targetRequestsQueue.push(
            processNetworkPostRequest(config, url, options),
          )
        }
      }

      if (bulkData.length > 0) {
        // Bulk creation
        const rawPath = config.typeConfig?.target?.[endpoint]?.endpoints?.create?.bulk_path
        const dataKey = config.typeConfig?.target?.[endpoint]?.endpoints?.create?.data_key || ''
        const url = (config.baseUrl || '')
          + (config.typeConfig?.base_path || '')
          + (rawPath || '')

        if (multiTarget) {
          if (!multiBulkData[endpoint]) {
            multiBulkData[endpoint] = []
          }
          multiBulkData[endpoint].push(...bulkData)
        }
        else {
          options.data = dataUtils.buildRequestData(
            dataKey,
            {},
            { [endpoint]: bulkData },
          )

          if (config.gitRepo || config.gitBranch || config.gitSha) {
            options.data.source_control = {
              repo: config.gitRepo,
              branch: config.gitBranch,
              sha: config.gitSha,
            }
          }

          // Add our override data on create
          if (config.overrides?.[endpoint]) {
            for (const [key, value] of Object.entries(config.overrides[endpoint])) {
              options.data[key] = value
            }
          }

          targetRequestsQueue.push(
            processNetworkPostRequest(config, url, options),
          )
        }
      }
    }
  }

  if (Object.keys(multiBulkData).length > 0) {
    // Multi-target bulk creation
    const rawPath = config.typeConfig?.multi_target_path
    const url = (config.baseUrl || '')
      + (config.typeConfig?.base_path || '')
      + (rawPath || '')
    const options: AxiosRequestConfig = {}

    // Add authn to the request
    if (config.authSchema?.location === 'header') {
      options.headers = {}
      const keys = configUtils.findSubstitutionKeys(config.authSchema.payload)
      // Loop through the replacement keys (in {}) on this endpoint
      for (const key of keys) {
        // Pull identifier
        if (options.headers && config.authSchema.key && config.authPayload) {
          options.headers[config.authSchema.key] = config.authPayload
        }
      }
    }

    options.data = multiBulkData

    if (config.gitRepo || config.gitBranch || config.gitSha) {
      options.data.source_control = {
        repo: config.gitRepo,
        branch: config.gitBranch,
        sha: config.gitSha,
      }
    }

    // Add our override data on create
    if (config.overrides?.multi_target) {
      for (const [key, value] of Object.entries(config.overrides.multi_target)) {
        options.data[key] = value
      }
    }

    targetRequestsQueue.push(
      processNetworkPostRequest(config, url, options),
    )
  }

  // Wait for all calls to finish before proceding
  await Promise.all(targetRequestsQueue).then((responses) => {
    for (let i = responses.length - 1; i >= 0; i--) {
      targetRequestsQueue.splice(i, 1)
    }
    // config.progressBar.update(config.targetProgressIncrement);
  })
}

async function processNetworkGetRequest(
  config: configUtils.EndpointConfig,
  url: string,
  options: AxiosRequestConfig,
  type: string,
): Promise<ResponseData> {
  // Throttle requests
  const now = Date.now()
  sourceThrottleCounter.push(now)
  const throttleWindow = sourceThrottleCounter.filter(
    time => time > now - 1000,
  )
  if (throttleWindow.length > config.throttleCap) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return processNetworkGetRequest(config, url, options, type)
  }

  // Track requests
  if (!sourceResponseCounter[type]) {
    sourceResponseCounter[type] = 0
  }
  sourceResponseCounter[type]++

  try {
    // console.log(`GET ${url}`);
    const response: AxiosResponse = await axios.get(url, options)
    return {
      data: response.data,
      source_type: type,
      target_type: config.typeConfig?.source?.[type]?.target_type || type,
    }
  }
  catch (error) {
    console.error(`Error fetching ${url}: ${error}`)
    return {
      data: [],
      source_type: type,
      target_type: config.typeConfig?.source?.[type]?.target_type || type,
    }
  }
}

async function processNetworkPostRequest(
  config: configUtils.EndpointConfig,
  url: string,
  options: AxiosRequestConfig,
): Promise<any> {
  // Throttle requests
  const now = Date.now()
  targetThrottleCounter.push(now)
  const throttleWindow = targetThrottleCounter.filter(
    time => time > now - 1000,
  )
  if (throttleWindow.length > config.throttleCap) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return processNetworkPostRequest(config, url, options)
  }

  try {
    // console.log(`POST ${url}`);
    // console.log(JSON.stringify(options.data, null, 2));
    const response: AxiosResponse = await axios.post(url, options.data, options)
    return response.data
  }
  catch (error) {
    console.error(`Error posting to ${url}: ${error}`)
    return {}
  }
}
