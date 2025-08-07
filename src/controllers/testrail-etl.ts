import type { ConfigType } from '../utils/config-schema'
import type { ETLv2Options } from './etl-base-v2'

import * as p from '@clack/prompts'
import { loadConfig } from '../utils/enhanced-config-loader'
import { processBatchedRequests } from '../utils/network'
import { err, ok } from '../utils/result'
import { ETLv2 } from './etl-base-v2'

export class TestRailETL extends ETLv2 {
  /**
   * Create a new TestRailETL instance
   * @param configSchema The full configuration schema
   * @param options Additional ETL options including credentials
   */
  constructor(configSchema: ConfigType, options: ETLv2Options = {}) {
    super(configSchema, options)
  }

  /**
   * Submit data to a specific target endpoint using ETLv2's loadToTarget method
   * @param targetType The target type (projects, suites, cases, plans, runs, executions)
   * @param data The data to submit
   * @param endpoint The endpoint type (create, update, etc.)
   * @returns The response from TestRail
   */
  async submitToTarget(
    targetType: 'projects' | 'suites' | 'cases' | 'plans' | 'runs' | 'executions' | 'sections',
    data: any,
    endpoint: string = 'create',
  ): Promise<Record<string, any>> {
    return await this.loadToTarget(targetType, data, endpoint)
  }

  /**
   * Create a section (folder) in TestRail
   * @param sectionData The section data to submit
   * @returns The response from TestRail with the created section
   */
  async createSection(sectionData: any, params: any): Promise<Record<string, any>> {
    try {
      if (!sectionData.name) {
        throw new Error('name is required for creating a section')
      }

      const response = await this.dataLoader.loadToTarget('sections', sectionData, 'create', this.configManager.getConfig(), params)

      if (!response) {
        throw new Error('TestRail section creation received no response')
      }

      return response
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`TestRail section creation failed: ${errorMessage}`)
    }
  }

  /**
   * Create a test case in TestRail
   * @param caseData The test case data to submit
   * @returns The response from TestRail with the created test case
   */
  async createTestCase(caseData: any, params: any): Promise<Record<string, any>> {
    try {
      if (!caseData.title) {
        throw new Error('title is required for creating a test case')
      }

      const response = await this.dataLoader.loadToTarget('cases', caseData, 'create', this.configManager.getConfig(), params)

      if (!response) {
        throw new Error('TestRail test case creation received no response')
      }

      return response
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`TestRail test case creation failed: ${errorMessage}`)
    }
  }

  /**
   * Create a test results in TestRail
   * @param resultData The test result data to submit
   * @returns The response from TestRail with the created test result
   */
  async createTestResult(resultData: any): Promise<Record<string, any>> {
    try {
      const response = await this.dataLoader.loadToTarget('results', resultData, 'create', this.configManager.getConfig())

      if (!response) {
        throw new Error('TestRail test result creation received no response')
      }

      return response
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`TestRail test result creation failed: ${errorMessage}`)
    }
  }

  /**
   * Create a test suite in TestRail
   * @param suiteData The test suite data to submit
   * @returns The response from TestRail with the created test suite
   */
  async createTestSuite(suiteData: any): Promise<Record<string, any>> {
    try {
      console.log(suiteData)
      const response = await this.dataLoader.loadToTarget('suites', suiteData, 'create', this.configManager.getConfig())

      if (!response) {
        throw new Error('TestRail test suite creation received no response')
      }

      return response
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`TestRail test suite creation failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test run data to TestRail using direct loadToTarget method
   * @param runData The test run data to submit
   * @returns The response from TestRail
   */
  async submitTestRun(resultData: any, params: any, runName: string): Promise<Record<string, any>> {
    const spinner = p.spinner()
    try {
      spinner.start('Checking project mode')
      const projectResponse = await this.getProjectById(params.project_id)
      spinner.stop('Project mode checked successfully')
      let suiteResponse: any
      if (projectResponse.suite_mode === 3) {
        spinner.start('Creating test suite')
        suiteResponse = await this.createTestSuite({
          name: resultData.root.name,
        })
        spinner.stop('Test suite created successfully')
      }

      const sections = resultData.sections || []
      const sectionIdMap = new Map()
      const sectionRequests = sections.map((section: { name: string, id: string, [key: string]: any }) => {
        return async () => {
          try {
            const response = await this.createSection({
              name: section.name,
              suite_id: suiteResponse?.id || null,
            }, params)

            let result: Record<string, any>
            if (response && typeof response.json === 'function') {
              result = await response.json()
            }
            else {
              result = response as Record<string, any>
            }

            if (section.id && result.id) {
              sectionIdMap.set(section.id, result.id)
            }

            return ok(result)
          }
          catch (error) {
            throw err(error instanceof Error ? error : new Error(String(error)))
          }
        }
      })
      const batchResult1 = await processBatchedRequests<Record<string, any>, Error>(
        sectionRequests,
        this.options.maxConcurrency || 5,
        this.options.batchSize || 5,
        1000,
        {
          retry: this.options.retryAttempts,
          retryDelay: 1000,
          timeout: this.options.timeout,
          silent: false,
          showProgress: true,
          progressLabel: 'sections',
        },
      )

      if (batchResult1.isOk) {
        spinner.stop(`${sectionIdMap.size} sections created successfully`)
      }
      else {
        const errorObj = batchResult1 as { error: Error }
        spinner.stop('Error creating sections')
        throw new Error(`TestRail section creation failed: ${errorObj.error}`)
      }

      const testCases = resultData.cases || []

      testCases.forEach((testCase: any) => {
        if (testCase.section_id && sectionIdMap.has(testCase.section_id)) {
          testCase.section_id = sectionIdMap.get(testCase.section_id)
        }
        else if (sectionIdMap.has('default')) {
          testCase.section_id = sectionIdMap.get('default')
        }
      })

      const caseIds: number[] = []
      const casesIdMap = new Map()

      const requests = testCases.map((testCase: { title: string, section_id: string, [key: string]: any }) => {
        return async () => {
          try {
            if (this.options?.credentials?.section_id !== testCase.section_id) {
              // this.updateCredentials({ ...this.options.credentials, section_id: testCase.section_id })
              // this.configManager.applySubstitutions()
            }

            const response = await this.createTestCase({
              title: testCase.title || testCase.name,
            }, { section_id: testCase.section_id })

            let result: Record<string, any>
            if (response && typeof response.json === 'function') {
              result = await response.json()
            }
            else {
              result = response as Record<string, any>
            }

            if (testCase.id && result.id) {
              casesIdMap.set(testCase.id, result.id)
            }

            return ok(result)
          }
          catch (error) {
            return err(error instanceof Error ? error : new Error(String(error)))
          }
        }
      })

      const batchResult = await processBatchedRequests<Record<string, any>, Error>(
        requests,
        this.options.maxConcurrency || 5,
        this.options.batchSize || 10,
        1000,
        {
          retry: this.options.retryAttempts,
          retryDelay: 1000,
          timeout: this.options.timeout,
          silent: false,
          showProgress: true,
          progressLabel: 'test cases',
        },
      )

      if (batchResult.isOk) {
        const results = batchResult.unwrap()
        for (const result of results) {
          if (result && result.id) {
            caseIds.push(result.id)
          }
        }
      }
      else {
        const errorObj = batchResult as { error: Error }
        console.error('Error creating test cases:', errorObj.error)
      }

      spinner.stop('Test cases created successfully')

      const run = {
        name: runName,
        case_ids: caseIds,
        include_all: false,
        suite_id: suiteResponse?.id || null,
      }

      spinner.start('Creating test run')
      const runResponse = await this.dataLoader.loadToTarget('runs', run, 'create', this.configManager.getConfig(), params)

      if (!runResponse) {
        throw new Error('TestRail submission received no response')
      }
      spinner.stop('Test run created successfully')
      spinner.start('Creating test results')

      const testResults = resultData.results || []
      testResults.forEach((testResult: any) => {
        if (testResult.case_id && casesIdMap.has(testResult.case_id)) {
          testResult.case_id = casesIdMap.get(testResult.case_id)
        }
        else if (casesIdMap.has('default')) {
          testResult.case_id = casesIdMap.get('default')
        }
      })
      this.updateCredentials({ ...this.options.credentials, run_id: runResponse.id })
      this.configManager.applySubstitutions()
      await this.createTestResult({ results: testResults })
      spinner.stop(`Test results created successfully`)
      return runResponse
    }
    catch (error) {
      spinner.stop()
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`TestRail submission failed: ${errorMessage}`)
    }
  }

  /**
   * Get a specific project by ID from TestRail
   * @param projectId The project ID to fetch
   * @returns The specific project data
   */
  async getProjectById(projectId: string): Promise<Record<string, any>> {
    return await this.dataExtractor.extract('projects', { project_id: projectId }, 'get', this.configManager.getConfig())
  }

  /**
   * Submit project data to TestRail using ETLv2 enhanced workflow
   * @param projectData The project data to submit
   * @returns The response from TestRail
   */
  async submitProjects(projectData: any): Promise<Record<string, any>> {
    const response = await this.dataLoader.loadToTarget('projects', projectData, 'create', this.configManager.getConfig())

    if (response.id) {
      return response
    }
    else {
      throw new Error(`TestRail projects submission failed: ${response}`)
    }
  }

  /**
   * Submit project data to TestRail using ETLv2 enhanced workflow
   * @param projectData The project data to submit
   * @returns The response from TestRail
   */
  async deleteProjects(): Promise<Record<string, any>> {
    const spinner = p.spinner()
    spinner.start('Deleting Project')
    const response = await this.dataLoader.loadToTarget('projects', {}, 'delete', this.configManager.getConfig())
    spinner.stop('Project Deleted successfully')

    if (response) {
      return response
    }
    else {
      throw new Error(`TestRail projects submission failed: ${response}`)
    }
  }

  /**
   * Submit test suite data to TestRail using ETLv2 enhanced workflow
   * @param suiteData The test suite data to submit
   * @returns The response from TestRail
   */
  async submitSuites(suiteData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ suites: Array.isArray(suiteData) ? suiteData : [suiteData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestRail suites submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test case data to TestRail using ETLv2 enhanced workflow
   * @param caseData The test case data to submit
   * @returns The response from TestRail
   */
  async submitCases(caseData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ cases: Array.isArray(caseData) ? caseData : [caseData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestRail cases submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test plan data to TestRail using ETLv2 enhanced workflow
   * @param planData The test plan data to submit
   * @returns The response from TestRail
   */
  async submitPlans(planData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ plans: Array.isArray(planData) ? planData : [planData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestRail plans submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit test execution data to TestRail using ETLv2 enhanced workflow
   * @param executionData The test execution data to submit
   * @returns The response from TestRail
   */
  async submitExecutions(executionData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ executions: Array.isArray(executionData) ? executionData : [executionData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestRail executions submission failed: ${errorMessage}`)
    }
  }

  /**
   * Factory method to create a TestRailETL instance from a configuration
   * @param options Configuration options
   * @param options.configPath Optional path to the configuration file
   * @param options.credentials Optional credentials to use for authentication
   * @param options.etlOptions Optional ETLv2 options for enhanced functionality
   * @returns A new TestRailETL instance
   */
  static async fromConfig(options: {
    configPath?: string
    credentials?: Record<string, any>
    etlOptions?: ETLv2Options
  } = {}): Promise<TestRailETL> {
    const { configPath, credentials, etlOptions } = options

    const result = loadConfig({
      configPath,
      configName: 'testrail',
    })

    if (!result.isOk) {
      throw new Error('Failed to load TestRail configuration')
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
    return new TestRailETL(fullConfig, finalEtlOptions)
  }
}
