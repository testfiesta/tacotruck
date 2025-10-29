export interface TestRailClientOptions {
  baseUrl: string
  apiKey: string
}
export interface TestFiestaClientOptions {
  apiKey: string
  baseUrl?: string
  organizationHandle: string
  projectKey?: string
}

export interface BaseArgs {
  url?: string
}
