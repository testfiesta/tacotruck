import open from 'open'

export async function openUrl(url: string): Promise<void> {
  try {
    await open(url, { wait: false })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Failed to open URL: ${url} (${message})`)
  }
}
