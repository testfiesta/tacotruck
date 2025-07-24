import type { ConfigType } from '../utils/config-schema'
import type { ETLOptions } from './etl-base'
import { apiClient } from '../services/api-client'
import { loadConfig } from '../utils/enhanced-config-loader'
import { ETL } from './etl-base'

export class TestFiestaETL extends ETL {
  /**
   * Create a new TestFiestaETL instance
   * @param configSchema The full configuration schema
   * @param options Additional ETL options including credentials
   */
  constructor(configSchema: ConfigType, options: ETLOptions = {}) {
    super(configSchema, options)
    this.baseUrl = 'https://testfiesta.com/api/v1/'
  }

  protected override initializeConfig(): void {
    super.initializeConfig()
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

    // Use auth options directly
    const response = await apiClient.processPostRequest(
      this.authOptions,
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

    // Create ETLOptions from the provided options
    const etlOptions: ETLOptions = {}
    if (credentials) {
      etlOptions.credentials = credentials
    }

    return new TestFiestaETL(fullConfig, etlOptions)
  }
}
