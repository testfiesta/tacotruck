import type { ETLConfig } from '../utils/etl-types'
import { loadConfig } from '../utils/config-loader'
import * as etl from './etl'

export class TestFiestaETL {
  private config: ETLConfig

  constructor(config: ETLConfig) {
    this.config = config
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

    // Transform and load the data
    const transformedData = this.transform(data)
    await this.load(transformedData)

    return transformedData
  }

  /**
   * Factory method to create a TestFiestaETL instance from a configuration file
   * @param configPath Path to the configuration file
   * @param credentials Optional credentials to use for authentication
   * @returns A new TestFiestaETL instance
   */
  static async fromConfigFile(configPath: string, credentials?: Record<string, any>): Promise<TestFiestaETL> {
    const config = await loadConfig(configPath, credentials)
    return new TestFiestaETL(config as unknown as ETLConfig)
  }
}
