import type { ConfigType } from '../utils/config-schema'
import { apiClient } from '../services/api-client'
import { bracketSubstitution, findSubstitutionKeys, loadConfig } from '../utils/enhanced-config-loader'
import { ETL } from './etl-base'

export class TestFiestaETL extends ETL {
  /**
   * Create a new TestFiestaETL instance
   * @param configSchema The full configuration schema
   */
  constructor(configSchema: ConfigType) {
    super(configSchema)
    this.baseUrl = 'https://testfiesta.com/api/v1/'
  }

  protected override initializeConfig(): void {
    super.initializeConfig()
    this.applyConfigSubstitutions()
    this.prepareApiClient()
  }

  private prepareApiClient(): void {
    if (!this.config.auth) {
      this.config.auth = {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer {token}',
      }
    }

    if (this.config.auth.payload) {
      const credentials = (this.config as any).credentials || {}
      this.config.auth.payload = this.processSubstitutions(this.config.auth.payload, credentials)
    }
  }

  private applyConfigSubstitutions(): void {
    const credentials = (this.config as any).credentials || {}

    if (this.config.auth?.payload) {
      this.config.auth.payload = this.processSubstitutions(this.config.auth.payload, credentials)
    }
    else if (this.config.auth?.type === 'bearer' && !this.config.auth.payload) {
      console.warn('Bearer auth is configured but no payload is set. Token will not be included in requests.')
    }

    if (this.config.base_path) {
      this.config.base_path = this.processSubstitutions(this.config.base_path, credentials)
    }

    if (this.config.type === 'api' && 'multi_target' in this.config && this.config.multi_target?.path) {
      this.config.multi_target.path = this.processSubstitutions(
        this.config.multi_target.path,
        credentials,
      )
    }

    if (this.config.target) {
      for (const entityType of Object.keys(this.config.target)) {
        const entity = this.config.target[entityType]
        if (entity?.endpoints) {
          for (const operation of Object.keys(entity.endpoints)) {
            const endpoint = entity.endpoints[operation]

            if (endpoint.bulk_path) {
              endpoint.bulk_path = this.processSubstitutions(endpoint.bulk_path, credentials)
            }
            if (endpoint.single_path) {
              endpoint.single_path = this.processSubstitutions(endpoint.single_path, credentials)
            }
            if (endpoint.path) {
              endpoint.path = this.processSubstitutions(endpoint.path, credentials)
            }
          }
        }
      }
    }
  }

  /**
   * Process all substitutions in a string
   * @param value String containing substitution placeholders
   * @param credentials Credentials object with values for substitution
   * @returns String with substitutions applied
   */
  private processSubstitutions(value: string, credentials: Record<string, any>): string {
    let result = value
    const keys = findSubstitutionKeys(value)

    for (const key of keys) {
      if (credentials[key] !== undefined) {
        result = bracketSubstitution(result, key, credentials[key])
      }
    }

    return result
  }

  /**
   * Submit test run data to TestFiesta
   * @param runData The test run data to submit
   * @returns The response from TestFiesta
   */
  async submitTestRun(runData: any): Promise<Record<string, any>> {
    const configAny = this.config as any
    const multiTarget = configAny.multi_target

    if (!multiTarget || !multiTarget.path) {
      throw new Error('No multi_target path defined in TestFiesta configuration')
    }

    const path = multiTarget.path
    const submitUrl = this.buildEndpointUrl(path)

    const formattedData: Record<string, any> = {}

    if (multiTarget.data_key) {
      formattedData[multiTarget.data_key] = Array.isArray(runData) ? { runs: runData } : { runs: [runData] }
    }
    else {
      formattedData.data = Array.isArray(runData) ? { runs: runData } : { runs: [runData] }
    }

    if (multiTarget.include_source) {
      formattedData.source = 'testfiesta'
    }

    const response = await apiClient.processPostRequest(
      this.config as any,
      submitUrl,
      { data: formattedData },
    )

    return response || {}
  }

  /**
   * Factory method to create a TestFiestaETL instance from a configuration
   * @param options Configuration options
   * @param options.configPath Optional path to the configuration file
   * @param options.credentials Optional credentials to use for authentication
   * @returns A new TestFiestaETL instance
   */
  static async fromConfig(options: { configPath?: string, credentials?: Record<string, any> } = {}): Promise<TestFiestaETL> {
    const { configPath, credentials } = options

    const result = loadConfig({
      configPath,
      configName: 'testfiesta',
      credentials,
    })

    if (!result.isOk) {
      throw new Error('Failed to load config')
    }

    const fullConfig = result.unwrap()

    return new TestFiestaETL(fullConfig)
  }
}
