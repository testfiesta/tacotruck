import type { ConfigType } from '../utils/config-schema'
import { bracketSubstitution, findSubstitutionKeys } from '../utils/enhanced-config-loader'

export interface ConfigurationManagerOptions {
  baseUrl?: string
  credentials?: Record<string, any>
  allowMutation?: boolean
}

export class ConfigurationManager {
  private originalConfig: ConfigType
  private processedConfig: ConfigType
  private credentials: Record<string, any>
  private allowMutation: boolean
  private baseUrl: string = ''

  constructor(config: ConfigType, options: ConfigurationManagerOptions = {}) {
    this.originalConfig = structuredClone(config)
    this.processedConfig = structuredClone(config)
    this.credentials = options.credentials || {}
    this.allowMutation = options.allowMutation ?? false
    this.baseUrl = options.baseUrl || ''
  }

  /**
   * Get the processed configuration
   * @returns The configuration with all substitutions applied
   */
  getConfig(): ConfigType {
    return this.allowMutation ? this.processedConfig : structuredClone(this.processedConfig)
  }

  /**
   * Get the original unmodified configuration
   * @returns The original configuration
   */
  getOriginalConfig(): ConfigType {
    return structuredClone(this.originalConfig)
  }

  /**
   * Update credentials and reprocess configuration
   * @param credentials New credentials to use
   */
  updateCredentials(credentials: Record<string, any>): void {
    this.credentials = { ...this.credentials, ...credentials }
    this.reprocessConfiguration()
  }

  getCredentials() {
    return this.credentials
  }

  /**
   * Apply all configuration substitutions
   */
  applySubstitutions(): void {
    this.applyBasePathSubstitutions()
    this.applySourceConfigSubstitutions()
    this.applyTargetConfigSubstitutions()
    this.applyAuthSubstitutions()
    this.applyCustomObjectSubstitutions()
  }

  /**
   * Get base URL from configuration
   * @returns The base URL or empty string if not found
   */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Get integration name from configuration
   * @returns The integration name
   */
  getIntegrationName(): string {
    if (this.processedConfig.type === 'api'
      || this.processedConfig.type === 'json'
      || this.processedConfig.type === 'junit') {
      if ('name' in this.processedConfig) {
        return this.processedConfig.name
      }
    }
    return 'default'
  }

  /**
   * Get endpoint set from source configuration
   * @returns Array of endpoint names
   */
  getEndpointSet(): string[] {
    if (this.processedConfig.type === 'api' && this.processedConfig.source) {
      return Object.keys(this.processedConfig.source)
    }
    return []
  }

  /**
   * Validate configuration structure
   * @throws Error if configuration is invalid
   */
  validateConfiguration(): void {
    if (!this.processedConfig) {
      throw new Error('Configuration is required')
    }

    if (!this.processedConfig.type) {
      throw new Error('Configuration type is required')
    }

    if (this.processedConfig.type === 'api') {
      this.validateApiConfiguration()
    }
  }

  /**
   * Process all substitutions in a string
   * @param value String containing substitution placeholders
   * @param credentials Credentials object with values for substitution
   * @returns String with substitutions applied
   */
  private processSubstitutions(value: string, credentials?: Record<string, any>): string {
    const credsToUse = credentials || this.credentials
    let result = value
    const keys = findSubstitutionKeys(value)

    for (const key of keys) {
      if (credsToUse[key] !== undefined) {
        result = bracketSubstitution(result, key, credsToUse[key])
      }
    }

    return result
  }

  /**
   * Apply substitutions to base path
   */
  private applyBasePathSubstitutions(): void {
    if (this.processedConfig.base_path) {
      this.processedConfig.base_path = this.processSubstitutions(this.processedConfig.base_path)
    }
  }

  /**
   * Apply substitutions to source configuration
   */
  private applySourceConfigSubstitutions(): void {
    if (this.processedConfig.type === 'api' && this.processedConfig.source) {
      for (const entityType of Object.keys(this.processedConfig.source)) {
        const entity = this.processedConfig.source[entityType]
        if (entity?.endpoints) {
          for (const operation of Object.keys(entity.endpoints)) {
            const endpoint = entity.endpoints[operation]

            if (endpoint.path) {
              endpoint.path = this.processSubstitutions(endpoint.path)
            }
          }
        }
      }
    }
  }

  /**
   * Apply substitutions to target configuration
   */
  private applyTargetConfigSubstitutions(): void {
    if (this.processedConfig.type === 'api' && 'multi_target' in this.processedConfig && this.processedConfig.multi_target?.path) {
      this.processedConfig.multi_target.path = this.processSubstitutions(this.processedConfig.multi_target.path)
    }

    if (this.processedConfig.target) {
      for (const entityType of Object.keys(this.processedConfig.target)) {
        const entity = this.processedConfig.target[entityType]
        if (entity?.endpoints) {
          for (const operation of Object.keys(entity.endpoints)) {
            const endpoint = entity.endpoints[operation]

            if (endpoint.bulk_path) {
              endpoint.bulk_path = this.processSubstitutions(endpoint.bulk_path)
            }
            if (endpoint.single_path) {
              endpoint.single_path = this.processSubstitutions(endpoint.single_path)
            }
            if (endpoint.path) {
              endpoint.path = this.processSubstitutions(endpoint.path)
            }
          }
        }
      }
    }
  }

  /**
   * Apply substitutions to authentication configuration
   */
  private applyAuthSubstitutions(): void {
    if (this.processedConfig.auth?.payload) {
      this.processedConfig.auth.payload = this.processSubstitutions(this.processedConfig.auth.payload)
    }
  }

  /**
   * Apply substitutions to custom nested objects in the configuration
   */
  private applyCustomObjectSubstitutions(): void {
    // Process any custom fields that might contain substitution placeholders
    this.processNestedObjects(this.processedConfig)
  }

  /**
   * Recursively process nested objects for substitutions
   * @param obj The object to process
   */
  private processNestedObjects(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return
    }

    for (const key of Object.keys(obj)) {
      const value = obj[key]

      if (typeof value === 'string') {
        // Apply substitutions to string values
        obj[key] = this.processSubstitutions(value)
      }
      else if (value && typeof value === 'object') {
        // Recursively process nested objects
        this.processNestedObjects(value)
      }
    }
  }

  /**
   * Reprocess the entire configuration from scratch
   */
  private reprocessConfiguration(): void {
    this.processedConfig = structuredClone(this.originalConfig)
    this.applySubstitutions()
  }

  /**
   * Validate API-specific configuration
   */
  private validateApiConfiguration(): void {
    if (this.processedConfig.type !== 'api')
      return

    if (!this.processedConfig.base_path && !('baseUrl' in this.processedConfig)) {
      throw new Error('API configuration requires either base_path or baseUrl')
    }

    if (this.processedConfig.source) {
      for (const [entityType, entity] of Object.entries(this.processedConfig.source)) {
        if (entity?.endpoints) {
          for (const [operation, endpoint] of Object.entries(entity.endpoints)) {
            if (!endpoint.path) {
              throw new Error(`Source endpoint ${entityType}.${operation} missing path`)
            }
          }
        }
      }
    }

    if (this.processedConfig.target) {
      for (const [entityType, entity] of Object.entries(this.processedConfig.target)) {
        if (entity?.endpoints) {
          for (const [operation, endpoint] of Object.entries(entity.endpoints)) {
            if (!endpoint.bulk_path && !endpoint.single_path && !endpoint.path) {
              throw new Error(`Target endpoint ${entityType}.${operation} missing path configuration`)
            }
          }
        }
      }
    }
  }
}
