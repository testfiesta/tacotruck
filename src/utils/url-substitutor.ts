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

/**
 * Converts a backend API URL to the corresponding frontend dashboard URL
 * @param apiUrl The backend API URL (e.g., https://api.testfiesta.com, https://staging-api.testfiesta.com)
 * @returns The frontend dashboard URL (e.g., https://app.testfiesta.com, https://staging.app.testfiesta.com)
 */
export function convertApiUrlToDashboardUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl)
    const hostname = url.hostname

    // Handle localhost/127.0.0.1 - keep as is but use port 8082 for dashboard
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // For localhost, assume dashboard runs on port 8082
      return `${url.protocol}//${hostname}:8082`
    }

    // Handle staging environments
    if (hostname.includes('staging')) {
      // Replace staging-api or api with staging.app
      const newHostname = hostname.replace(/(staging-)?api\./, 'staging.app.')
      return `${url.protocol}//${newHostname}${url.port ? `:${url.port}` : ''}`
    }

    // Handle production - replace api with app
    const newHostname = hostname.replace(/api\./, 'app.')
    return `${url.protocol}//${newHostname}${url.port ? `:${url.port}` : ''}`
  }
  catch {
    // If URL parsing fails, try simple string replacement
    if (apiUrl.includes('staging')) {
      return apiUrl.replace(/(staging-)?api\./, 'staging.app.')
    }
    return apiUrl.replace(/api\./, 'app.')
  }
}

/**
 * Builds a complete dashboard URL for a test run
 * @param apiBaseUrl The backend API base URL (e.g., https://api.testfiesta.com)
 * @param organizationHandle The organization handle
 * @param projectKey The project key
 * @param runId The run ID (uid)
 * @param pathSuffix Optional path suffix (defaults to 'folders')
 * @returns The complete dashboard URL for the test run
 */
export function buildTestRunDashboardUrl(
  apiBaseUrl: string,
  organizationHandle: string,
  projectKey: string,
  runId: number | string,
  pathSuffix: string = 'folders',
): string {
  const dashboardBaseUrl = convertApiUrlToDashboardUrl(apiBaseUrl)
  // Ensure base URL doesn't have trailing slash
  const cleanBaseUrl = dashboardBaseUrl.replace(/\/$/, '')
  return `${cleanBaseUrl}/${organizationHandle}/${projectKey}/runs/${runId}/${pathSuffix}`
}
