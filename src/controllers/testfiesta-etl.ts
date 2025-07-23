import type { ETLConfig } from '../utils/etl-types'
import { bracketSubstitution, findSubstitutionKeys, loadConfig } from '../utils/enhanced-config-loader'
import * as etl from './etl'

export class TestFiestaETL {
  private config: ETLConfig

  constructor(config: ETLConfig) {
    this.config = config

    this.initializeConfig()
  }

  private initializeConfig(): void {
    if (!this.config.endpointSet) {
      this.config.endpointSet = []

      if (this.config.target) {
        this.config.endpointSet = Object.keys(this.config.target)
      }
    }

    if (this.config.auth?.payload && (this.config as any).credentials?.token) {
      const keys = findSubstitutionKeys(this.config.auth.payload)
      for (const key of keys) {
        if (key === 'token' && (this.config as any).credentials.token) {
          this.config.auth.payload = bracketSubstitution(
            this.config.auth.payload,
            'token',
            (this.config as any).credentials.token,
          )
        }
      }
    }
    else if (this.config.auth?.type === 'bearer' && !this.config.auth.payload) {
      console.warn('Bearer auth is configured but no payload is set. Token will not be included in requests.')
    }
  }

  /**
   * Execute the ETL process for TestFiesta
   * @param ids Optional record of IDs to fetch specific resources
   * @returns The processed data
   */
  async execute(ids: Record<string, Array<Record<string, any>>> = {}): Promise<Record<string, any>> {
    return await etl.executeETL(this.config, ids)
  }

  /**
   * Extract data from TestFiesta
   * @param ids Optional record of IDs to fetch specific resources
   * @returns The extracted data
   */
  async extract(ids: Record<string, Array<Record<string, any>>> = {}): Promise<Record<string, any>> {
    return await etl.extractData(this.config, ids)
  }

  /**
   * Transform data according to TestFiesta mapping rules
   * @param data The data to transform
   * @returns The transformed data
   */
  transform(data: Record<string, any>): Record<string, any> {
    return etl.transformData(this.config, data)
  }

  /**
   * Load data to TestFiesta
   * @param data The data to load
   */
  async load(data: Record<string, any>): Promise<void> {
    await etl.loadData(this.config, data)
  }

  /**
   * Submit test run data to TestFiesta
   * @param runData The test run data to submit
   * @returns The response from TestFiesta
   */
  async submitTestRun(runData: any): Promise<Record<string, any>> {
    const data: Record<string, any> = {
      source: 'testfiesta',
      runs: Array.isArray(runData) ? runData : [runData],
    }

    const transformedData = this.transform(data)
    await this.load(transformedData)

    return transformedData
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

    const config = result.unwrap() as unknown as ETLConfig

    return new TestFiestaETL(config)
  }
}
