/**
 * Maps data from one format to another based on the provided mapping
 * @param mapping Object containing key-value pairs for mapping
 * @param data The data to be mapped
 * @returns The mapped data
 */
export function mapData(mapping: Record<string, string>, data: Record<string, any>): Record<string, any> {
  const finalData = { ...data }
  for (const mapKey of Object.keys(mapping)) {
    if (finalData[mapKey]) {
      finalData[mapping[mapKey]] = finalData[mapKey]
      if (mapKey !== mapping[mapKey]) {
        delete finalData[mapKey]
      }
    }
  }
  return finalData
}

/**
 * Maps data with ignore patterns
 * @param mapping Object containing key-value pairs for mapping
 * @param data The data to be mapped
 * @param ignore Object containing keys to ignore with regex patterns
 * @returns The mapped data or false if data should be ignored
 */
export function mapDataWithIgnores(
  mapping: Record<string, string>,
  data: Record<string, any>,
  ignore: Record<string, string[]> = {},
): Record<string, any> | false {
  for (const [key, value] of Object.entries(data)) {
    if (ignore[key]) {
      for (const regex of ignore[key]) {
        if (new RegExp(regex).test(value)) {
          return false
        }
      }
    }
  }
  return mapData(mapping, data)
}

/**
 * Builds request data with a specific key structure
 * @param key The key to use for the data
 * @param mapping Object containing key-value pairs for mapping
 * @param data The data to be mapped
 * @returns The structured request data
 */
export function buildRequestData(
  key: string,
  mapping: Record<string, string>,
  data: Record<string, any>,
): Record<string, any> {
  const finalData = mapData(mapping, data)
  if (key && key !== '') {
    // Update to use the key inside the entity object.
    // For example: { executions: { entries: [] } } — here, "entries" is the key.
    return Object.keys(finalData).reduce((acc: Record<string, any>, curr: string) => {
      acc[curr] = {
        [key]: finalData[curr],
      }
      return acc
    }, {})
  }
  else {
    return finalData
  }
}
