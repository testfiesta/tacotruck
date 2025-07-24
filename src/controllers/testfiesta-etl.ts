import type { ConfigType } from '../utils/config-schema'
import type { ETLv2Options } from './etl-base-v2'
import { apiClient } from '../services/api-client'
import { loadConfig } from '../utils/enhanced-config-loader'
import { ETLv2 } from './etl-base-v2'

export class TestFiestaETL extends ETLv2 {
  /**
   * Create a new TestFiestaETL instance
   * @param configSchema The full configuration schema
   * @param options Additional ETL options including credentials
   */
  constructor(configSchema: ConfigType, options: ETLv2Options = {}) {
    super(configSchema, options)
  }

  /**
   * Submit data using multi_target configuration
   * @param dataType The type of data being submitted (for proper formatting)
   * @returns The response from TestFiesta
   */
  async submitMultiTarget(data: any, dataType: string = 'runs'): Promise<Record<string, any>> {
    const config = this.configManager.getConfig() as any
    const multiTarget = config.multi_target

    if (!multiTarget || !multiTarget.path) {
      throw new Error('No multi_target path defined in TestFiesta configuration')
    }

    const formattedData: Record<string, any> = {}

    if (multiTarget.data_key) {
      formattedData[multiTarget.data_key] = Array.isArray(data)
        ? { [dataType]: data }
        : { [dataType]: [data] }
    }
    else {
      formattedData.data = Array.isArray(data)
        ? { [dataType]: data }
        : { [dataType]: [data] }
    }

    if (multiTarget.include_source) {
      formattedData.source = 'testfiesta'
    }

    const baseUrl = this.configManager.getBaseUrl()
    const cleanBase = baseUrl.replace(/\/+$/, '')
    const cleanPath = multiTarget.path.replace(/^\/+/, '')
    const submitUrl = `${cleanBase}/${cleanPath}`

    const authOptions = this.authManager.getProcessedAuthOptions()
    const response = await apiClient.processPostRequest(
      authOptions,
      submitUrl,
      { data: formattedData },
    )

    return response || {}
  }

  /**
   * Submit data to a specific target endpoint using ETLv2's loadToTarget method
   * @param targetType The target type (projects, suites, cases, plans, runs, executions)
   * @param data The data to submit
   * @param endpoint The endpoint type (create, update, etc.)
   * @returns The response from TestFiesta
   */
  async submitToTarget(
    targetType: 'projects' | 'suites' | 'cases' | 'plans' | 'runs' | 'executions',
    data: any,
    endpoint: string = 'create',
  ): Promise<Record<string, any>> {
    return await this.loadToTarget(targetType, data, endpoint)
  }

  /**
   * Submit test run data to TestFiesta using ETLv2 enhanced workflow
   * @param runData The test run data to submit
   * @returns The response from TestFiesta
   */
  async submitTestRun(runData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ runs: Array.isArray(runData) ? runData : [runData] })

    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestFiesta submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit project data to TestFiesta using ETLv2 enhanced workflow
   * @param projectData The project data to submit
   * @returns The response from TestFiesta
   */
  async submitProjects(projectData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ projects: Array.isArray(projectData) ? projectData : [projectData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestFiesta projects submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test suite data to TestFiesta using ETLv2 enhanced workflow
   * @param suiteData The test suite data to submit
   * @returns The response from TestFiesta
   */
  async submitSuites(suiteData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ suites: Array.isArray(suiteData) ? suiteData : [suiteData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestFiesta suites submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test case data to TestFiesta using ETLv2 enhanced workflow
   * @param caseData The test case data to submit
   * @returns The response from TestFiesta
   */
  async submitCases(caseData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ cases: Array.isArray(caseData) ? caseData : [caseData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestFiesta cases submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test plan data to TestFiesta using ETLv2 enhanced workflow
   * @param planData The test plan data to submit
   * @returns The response from TestFiesta
   */
  async submitPlans(planData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ plans: Array.isArray(planData) ? planData : [planData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestFiesta plans submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test execution data to TestFiesta using ETLv2 enhanced workflow
   * @param executionData The test execution data to submit
   * @returns The response from TestFiesta
   */
  async submitExecutions(executionData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ executions: Array.isArray(executionData) ? executionData : [executionData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestFiesta executions submission failed: ${errorMessage}`)
    }
  }

  /**
   * Factory method to create a TestFiestaETL instance from a configuration
   * @param options Configuration options
   * @param options.configPath Optional path to the configuration file
   * @param options.credentials Optional credentials to use for authentication
   * @param options.etlOptions Optional ETLv2 options for enhanced functionality
   * @returns A new TestFiestaETL instance
   */
  static async fromConfig(options: {
    configPath?: string
    credentials?: Record<string, any>
    etlOptions?: ETLv2Options
  } = {}): Promise<TestFiestaETL> {
    const { configPath, credentials, etlOptions } = options

    const result = loadConfig({
      configPath,
      configName: 'testfiesta',
      credentials,
    })

    if (!result.isOk) {
      throw new Error('Failed to load TestFiesta configuration')
    }

    const fullConfig = result.unwrap()

    const finalEtlOptions: ETLv2Options = {
      credentials,
      enablePerformanceMonitoring: true,
      strictMode: false,
      retryAttempts: 3,
      timeout: 30000,
      validateData: true,
      batchSize: 100,
      maxConcurrency: 5,
      ...etlOptions,
    }
    return new TestFiestaETL(fullConfig, finalEtlOptions)
  }
}
