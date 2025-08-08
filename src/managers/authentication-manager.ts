import type { ConfigType } from '../utils/config-schema'

export interface AuthOptions {
  type: string
  location: 'header' | 'query' | 'body'
  key?: string
  payload?: string
}

export interface AuthenticationManagerOptions {
  credentials?: Record<string, any>
}

export class AuthenticationManager {
  private credentials: Record<string, any>
  private authOptions: AuthOptions | null = null

  constructor(options: AuthenticationManagerOptions = {}) {
    this.credentials = options.credentials || {}
  }

  /**
   * Initialize authentication from configuration
   * @param config The configuration object
   */
  initializeFromConfig(config: ConfigType): void {
    if (!config.auth) {
      this.authOptions = null
      return
    }

    this.authOptions = {
      type: config.auth.type,
      location: config.auth.location,
    }

    if (config.auth.key) {
      this.authOptions.key = config.auth.key
    }

    if (config.auth.payload) {
      this.authOptions.payload = config.auth.payload
    }
  }

  /**
   * Update credentials
   * @param credentials New credentials to merge with existing ones
   */
  updateCredentials(credentials: Record<string, any>): void {
    this.credentials = { ...this.credentials, ...credentials }
  }

  /**
   * Set credentials, replacing all existing ones
   * @param credentials New credentials to use
   */
  setCredentials(credentials: Record<string, any>): void {
    this.credentials = credentials
  }

  /**
   * Get current credentials
   * @returns Copy of current credentials
   */
  getCredentials(): Record<string, any> {
    return { ...this.credentials }
  }

  /**
   * Get authentication options
   * @returns Current auth options or null if not configured
   */
  getAuthOptions(): AuthOptions | null {
    return this.authOptions ? { ...this.authOptions } : null
  }

  /**
   * Check if authentication is configured
   * @returns True if auth options are available
   */
  hasAuthentication(): boolean {
    return this.authOptions !== null
  }

  /**
   * Get a specific credential value
   * @param key The credential key to retrieve
   * @returns The credential value or undefined if not found
   */
  getCredential(key: string): any {
    return this.credentials[key]
  }

  /**
   * Check if a credential exists
   * @param key The credential key to check
   * @returns True if the credential exists
   */
  hasCredential(key: string): boolean {
    return key in this.credentials && this.credentials[key] !== undefined && this.credentials[key] !== null
  }

  /**
   * Validate that all required credentials are present
   * @param requiredKeys Array of required credential keys
   * @throws Error if any required credentials are missing
   */
  validateRequiredCredentials(requiredKeys: string[]): void {
    const missingKeys = requiredKeys.filter(key => !this.hasCredential(key))

    if (missingKeys.length > 0) {
      throw new Error(`Missing required credentials: ${missingKeys.join(', ')}`)
    }
  }

  /**
   * Create auth options with processed payload using current credentials
   * @returns Auth options with credential substitutions applied
   */
  getProcessedAuthOptions(): AuthOptions | null {
    if (!this.authOptions) {
      return null
    }

    const processed = { ...this.authOptions }

    if (processed.payload) {
      if (processed.payload.includes('{token}') && this.hasCredential('token')) {
        processed.payload = processed.payload.replace('{token}', this.getCredential('token'))
      }

      for (const [key, value] of Object.entries(this.credentials)) {
        const placeholder = `{${key}}`
        if (processed.payload.includes(placeholder)) {
          processed.payload = processed.payload.replace(placeholder, String(value))
        }
      }
    }

    return processed
  }

  /**
   * Validate authentication configuration
   * @throws Error if authentication configuration is invalid
   */
  validateAuthConfiguration(): void {
    if (!this.authOptions) {
      return // No auth configured is valid
    }

    if (!this.authOptions.type) {
      throw new Error('Authentication type is required')
    }

    if (!this.authOptions.location) {
      throw new Error('Authentication location is required')
    }

    if (!['header', 'query', 'body'].includes(this.authOptions.location)) {
      throw new Error('Authentication location must be header, query, or body')
    }

    switch (this.authOptions.type.toLowerCase()) {
      case 'bearer':
        this.validateBearerAuth()
        break
      case 'basic':
        this.validateBasicAuth()
        break
      case 'apikey':
        this.validateApiKeyAuth()
        break
    }
  }

  /**
   * Validate bearer token authentication
   */
  private validateBearerAuth(): void {
    if (!this.authOptions?.payload) {
      throw new Error('Bearer authentication requires a payload template')
    }

    if (this.authOptions.payload.includes('{token}') && !this.hasCredential('token')) {
      throw new Error('Bearer authentication requires a token credential')
    }
  }

  /**
   * Validate basic authentication
   */
  private validateBasicAuth(): void {
    if (!this.hasCredential('base64Credentials')) {
      throw new Error('Basic authentication requires base64Credentials')
    }
  }

  /**
   * Validate API key authentication
   */
  private validateApiKeyAuth(): void {
    if (!this.authOptions?.key) {
      throw new Error('API key authentication requires a key field')
    }

    if (!this.hasCredential('apiKey') && !this.hasCredential('api_key')) {
      throw new Error('API key authentication requires an apiKey or api_key credential')
    }
  }

  /**
   * Clear all authentication data
   */
  clear(): void {
    this.credentials = {}
    this.authOptions = null
  }
}
