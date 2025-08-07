import type { ConfigType } from './config-schema'

/**
 * Builds URLs for data extraction based on endpoint configuration
 * @param config The endpoint configuration
 * @param rawPath The raw path template
 * @param data Existing data for reference
 * @param endpoint Current endpoint being processed
 * @param fetchType Whether this is an index or get request
 * @returns Array of constructed URLs
 */
export function buildUrls(
  config: ConfigType,
  rawPath: string,
  data: Record<string, any>,
  endpoint: string,
  fetchType: 'index' | 'get',
  ids?: Record<string, Array<Record<string, any>>>,
): string[] {
  const matches = rawPath.match(/\{([^}]+)\}/g) || []
  const unsortedKeys = matches.map(match => match.replace(/[{}]/g, ''))
  const keys: string[] = []
  const denormalizedConfigKeys = config.typeConfig?.denormalized_keys || {}

  if (Object.keys(denormalizedConfigKeys).length === 0) {
    keys.push(...unsortedKeys)
  }
  else {
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
  urlList.push(
    (config.base_path || '')
    + rawPath,
  )

  if (fetchType === 'index') {
    return buildIndexUrls(config, urlList, keys, data, endpoint)
  }
  else {
    return buildGetUrls(config, urlList, keys, endpoint, ids)
  }
}

/**
 * Builds URLs for index requests
 * @private
 */
function buildIndexUrls(
  config: ConfigType,
  urlList: string[],
  keys: string[],
  data: Record<string, any>,
  endpoint: string,
): string[] {
  for (const key of keys) {
    const splitKey = key.split('.')
    const refEndpoint = splitKey[0]
    const refLocation = (
      splitKey[1] && splitKey[1] !== 'id'
        ? splitKey[1]
        : 'source_id'
    )

    if (data[refEndpoint]) {
      const newUrlList: string[] = []

      for (let i = urlList.length - 1; i > -1; i--) {
        const url = urlList[i]
        for (const record of data[refEndpoint]) {
          let newUrl = url
          if (config.typeConfig?.denormalized_keys?.[endpoint]
            && config.typeConfig.denormalized_keys[endpoint][key]) {
            newUrl = newUrl.replace(
              `{${key}}`,
              record[config.typeConfig.denormalized_keys[endpoint][key]],
            )
          }
          else {
            newUrl = newUrl.replace(`{${key}}`, record[refLocation])
          }

          newUrlList.push(newUrl)
        }
      }

      urlList = [...newUrlList]
    }
  }

  return urlList
}

/**
 * Builds URLs for get requests
 * @private
 */
function buildGetUrls(
  config: ConfigType,
  urlList: string[],
  keys: string[],
  endpoint: string,
  ids?: Record<string, Array<Record<string, any>>>,
): string[] {
  if (!ids || !ids[endpoint]) {
    return urlList
  }

  const newUrlList: string[] = []

  for (let i = urlList.length - 1; i > -1; i--) {
    const url = urlList[i]

    for (const record of ids[endpoint]) {
      let newUrl = url
      for (const key of keys) {
        const splitKey = key.split('.')
        const refLocation = (
          splitKey[1] && splitKey[1] !== 'id'
            ? splitKey[1]
            : 'id'
        )

        if (record[refLocation]) {
          newUrl = newUrl.replace(`{${key}}`, record[refLocation])
        }
      }

      newUrlList.push(newUrl)
    }
  }

  return newUrlList.length > 0 ? newUrlList : urlList
}
