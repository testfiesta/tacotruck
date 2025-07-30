import type { ConfigType } from '../utils/config-schema'
import type { ETLv2Options } from './etl-base-v2'

import chalk from 'chalk'
import cliProgress from 'cli-progress'

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
  async createSection(sectionData: any): Promise<Record<string, any>> {
    try {
      if (!sectionData.name) {
        throw new Error('name is required for creating a section')
      }

      const response = await this.loadToTarget('sections', sectionData, 'create')

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
  async createTestCase(caseData: any): Promise<Record<string, any>> {
    try {
      if (!caseData.title) {
        throw new Error('title is required for creating a test case')
      }

      const response = await this.loadToTarget('cases', caseData, 'create')

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
   * Submit test run data to TestRail using direct loadToTarget method
   * @param runData The test run data to submit
   * @returns The response from TestRail
   */
  async submitTestRun(runData: any): Promise<Record<string, any>> {
    try {
      const response = await this.createSection({
        name: 'Test section/folder',
      })
      if (!response.id) {
        throw new Error('TestRail section creation received no response')
      }
      let sectionResponse
      if (response && typeof response.json === 'function') {
        sectionResponse = await response.json()
      }
      else {
        sectionResponse = response
      }

      this.updateCredentials({ ...this.options.credentials, section_id: sectionResponse.id })
      this.configManager.applySubstitutions()
      console.log(`${chalk.green('✓')} Created section`)

      const testCases = runData.executions || []
      console.log(`Processing ${testCases.length} test cases ...`)

      const progressBar = new cliProgress.SingleBar({
        format: (options, params, _payload) => {
          const barCompleteChar = '█'
          const barIncompleteChar = '░'
          const barSize = 30

          const completeSize = Math.round(params.progress * barSize)
          const incompleteSize = barSize - completeSize

          const bar = barCompleteChar.repeat(completeSize) + barIncompleteChar.repeat(incompleteSize)

          const percentage = Math.floor(params.progress * 100)
          const value = params.value
          const total = params.total

          return chalk.cyan('⏳ ')
            + chalk.magenta('[')
            + chalk.blue(bar)
            + chalk.magenta('] ')
            + chalk.yellow(`${percentage}%`)
            + chalk.white(' | ')
            + chalk.green(`${value}`)
            + chalk.white('/')
            + chalk.green(`${total}`)
            + chalk.white(' test cases')
        },
        barCompleteChar: '█',
        barIncompleteChar: '░',
      })

      progressBar.start(testCases.length, 0)

      const caseIds: number[] = []
      let processedCount = 0

      const requests = testCases.map((test: { name: string, [key: string]: any }) => {
        return async () => {
          try {
            const response = await this.createTestCase({
              title: test.name,
              section_id: sectionResponse.id,
            })

            let result: Record<string, any>
            if (response && typeof response.json === 'function') {
              result = await response.json()
            }
            else {
              result = response as Record<string, any>
            }

            processedCount++
            progressBar.update(processedCount)

            return ok(result)
          }
          catch (error) {
            processedCount++
            progressBar.update(processedCount)
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
          silent: true,
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

      progressBar.stop()

      console.log(`\n${chalk.green('✓')} ${chalk.bold('Successfully created')} ${chalk.cyan(caseIds.length)} ${chalk.bold('test cases')}`)

      const run = {
        name: runData.runs && runData.runs[0] ? runData.runs[0].name : 'Test Run',
        case_ids: caseIds,
        project_id: this.options.credentials?.project_id,
      }

      console.log(`⏳ Creating test run with data`)
      const runResponse = await this.dataLoader.loadToTarget('runs', run, 'create', this.configManager.getConfig())

      if (!runResponse) {
        throw new Error('TestRail submission received no response')
      }

      return runResponse
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`TestRail submission failed: ${errorMessage}`)
    }
  }

  /**
   * Submit project data to TestRail using ETLv2 enhanced workflow
   * @param projectData The project data to submit
   * @returns The response from TestRail
   */
  async submitProjects(projectData: any): Promise<Record<string, any>> {
    const etlResult = await this.execute({ projects: Array.isArray(projectData) ? projectData : [projectData] })
    if (etlResult.success) {
      return etlResult.loadingResult?.responses || { success: true }
    }
    else {
      const errorMessage = etlResult.errors.map(e => e.message).join('; ')
      throw new Error(`TestRail projects submission failed: ${errorMessage}`)
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
