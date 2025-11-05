import open from 'open'

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

export async function openUrl(url: string): Promise<void> {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string')
  }

  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL format: ${url}`)
  }

  try {
    await open(url, { wait: false })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to open URL in browser: ${message}`)
  }
}
