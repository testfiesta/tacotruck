/**
 * Substitutes values from an object into a URL string template
 * @param template The URL template with placeholders in {placeholder} format
 * @param values Object containing the values to substitute
 * @returns The URL with substituted values
 */
export function substituteUrl(template: string, values: Record<string, any>): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    return values[key] !== undefined ? String(values[key]) : match
  })
}

/**
 * Type-safe version that requires all placeholders to have corresponding values
 * @param template The URL template with placeholders in {placeholder} format
 * @param values Object containing the values to substitute
 * @returns The URL with substituted values, or throws error if missing values
 */
export function substituteUrlStrict(template: string, values: Record<string, any>): string {
  const matches = template.match(/\{([^}]+)\}/g) || []
  const requiredKeys = matches.map(match => match.replace(/[{}]/g, ''))

  const missingKeys = requiredKeys.filter(key => values[key] === undefined)
  if (missingKeys.length > 0) {
    throw new Error(`Missing required values for keys: ${missingKeys.join(', ')}`)
  }

  return substituteUrl(template, values)
}

export function convertApiUrlToDashboardUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl)
    const hostname = url.hostname

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${url.protocol}//${hostname}:8082`
    }

    if (hostname.includes('staging')) {
      const newHostname = hostname.replace(/(staging-)?api\./, 'staging.app.')
      return `${url.protocol}//${newHostname}${url.port ? `:${url.port}` : ''}`
    }

    const newHostname = hostname.replace(/api\./, 'app.')
    return `${url.protocol}//${newHostname}${url.port ? `:${url.port}` : ''}`
  }
  catch {
    if (apiUrl.includes('staging')) {
      return apiUrl.replace(/(staging-)?api\./, 'staging.app.')
    }
    return apiUrl.replace(/api\./, 'app.')
  }
}

export function buildTestRunDashboardUrl(
  apiBaseUrl: string,
  organizationHandle: string,
  projectKey: string,
  runId: number | string,
  pathSuffix: string = 'folders',
): string {
  const dashboardBaseUrl = convertApiUrlToDashboardUrl(apiBaseUrl)
  const cleanBaseUrl = dashboardBaseUrl.replace(/\/$/, '')
  return `${cleanBaseUrl}/${organizationHandle}/${projectKey}/runs/${runId}/${pathSuffix}`
}
