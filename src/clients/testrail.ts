import type { z } from 'zod'
import type {
  CreateCaseInput,
  CreateProjectInput,
  CreateResultInput,
  CreateRunInput,
  CreateSectionInput,
  CreateSectionResponseData,
  CreateSuiteInput,
  CreateSuiteResponseData,
  GetProjectResponseData,
  GetSuitesResponseData,

} from '../schemas/testrail'
import type { TestRailClientOptions } from '../types/type'
import type { AuthOptions } from '../utils/network'
import type { RunData } from '../utils/run-data-loader'
import type { XmlData } from '../utils/xml-transform'
import { Buffer } from 'node:buffer'
import {
  CreateCaseSchema,
  CreateProjectSchema,
  CreateResultSchema,
  CreateRunSchema,
  CreateSectionResponseDataSchema,
  CreateSectionSchema,
  CreateSuiteResponseDataSchema,
  CreateSuiteSchema,
  GetProjectResponseDataSchema,
  GetSuitesResponseDataSchema,
  TestResultsSchema,
} from '../schemas/testrail'
import * as networkUtils from '../utils/network'
import { processBatchedRequests } from '../utils/network'
import { getRoute as getRouteUtil } from '../utils/route'
import { substituteUrlStrict } from '../utils/url-substitutor'
import { transformXmlDataToTestRail } from '../utils/xml-transform'

export interface TRProgressCallbacks {
  onStart?: (message: string) => void
  onSuccess?: (message: string) => void
  onError?: (message: string, error?: Error) => void
  onProgress?: (current: number, total: number, label: string) => void
}

export class TestRailClient {
  protected authOptions: AuthOptions
  protected baseUrl: string
  private static readonly SUITE_MODE = {
    SINGLE_REPO: 1,
    SINGLE_REPO_WITH_BASELINE: 2,
    MULTIPLE_SUITES: 3,
  }

  private static readonly ROUTES = {
    PROJECTS: {
      LIST: '/api/v2/get_projects',
      GET: '/api/v2/get_project/{project_id}',
      CREATE: '/api/v2/add_project',
      DELETE: '/api/v2/delete_project/{project_id}',
    },
    RUNS: {
      LIST: '/api/v2/get_runs/{project_id}',
      CREATE: '/api/v2/add_run/{project_id}',
      GET: '/api/v2/get_run/{run_id}',
      UPDATE: '/api/v2/update_run/{run_id}',
      DELETE: '/api/v2/delete_run/{run_id}',
    },
    RESULTS: {
      LIST: '/api/v2/get_results_for_run/{run_id}',
      CREATE: 'api/v2/add_results_for_cases/{run_id}',
      GET: '/api/v2/get_result/{result_id}',
      UPDATE: '/api/v2/update_result/{result_id}',
      DELETE: '/api/v2/delete_result/{result_id}',
    },
    SECTIONS: {
      LIST: '/api/v2/get_sections/{project_id}',
      CREATE: '/api/v2/add_section/{project_id}',
      GET: '/api/v2/get_section/{section_id}',
      UPDATE: '/api/v2/update_section/{section_id}',
      DELETE: '/api/v2/delete_section/{section_id}',
    },
    CASES: {
      LIST: '/api/v2/get_cases/{project_id}',
      CREATE: '/api/v2/add_case/{section_id}',
      GET: '/api/v2/get_case/{case_id}',
      UPDATE: '/api/v2/update_case/{case_id}',
      DELETE: '/api/v2/delete_case/{case_id}',
    },
    SUITES: {
      CREATE: '/api/v2/add_suite/{project_id}',
      GET: '/api/v2/get_suite/{suite_id}',
      GET_SUITES: '/api/v2/get_suites/{project_id}',
      UPDATE: '/api/v2/update_suite/{suite_id}',
      DELETE: '/api/v2/delete_suite/{suite_id}',
    },
  } as const

  constructor(options: TestRailClientOptions) {
    this.baseUrl = options.baseUrl
    this.authOptions = {
      type: 'basic',
      location: 'header',
      key: 'Authorization',
      payload: `Basic ${Buffer.from(`${options.username}:${options.password}`).toString('base64')}`,
    }
  }

  private buildRoute(route: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const fullRoute = `${this.baseUrl}/index.php?${route}`
    return substituteUrlStrict(fullRoute, { ...params, ...queryParams })
  }

  private validateData<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid ${context} input: ${result.error.message}`)
    }
    return result.data
  }

  public getRoute(resource: string, action: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const routeMap = {
      projects: TestRailClient.ROUTES.PROJECTS,
      runs: TestRailClient.ROUTES.RUNS,
      sections: TestRailClient.ROUTES.SECTIONS,
      cases: TestRailClient.ROUTES.CASES,
      results: TestRailClient.ROUTES.RESULTS,
      suites: TestRailClient.ROUTES.SUITES,
    } as const

    return getRouteUtil(
      routeMap,
      resource,
      action,
      (route, params, queryParams) => this.buildRoute(route, params, queryParams),
      params,
      queryParams,
    )
  }

  async createProject(
    createProjectInput: CreateProjectInput,
    params?: Record<string, string>,
  ): Promise<GetProjectResponseData> {
    const validatedData = this.validateData(CreateProjectSchema, createProjectInput, 'project')

    try {
      const response = await networkUtils.processPostRequest(this.authOptions, this.getRoute('projects', 'create', params), {
        json: validatedData,
      })
      const validatedResponse = this.validateData(GetProjectResponseDataSchema, response, 'project')
      return validatedResponse
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async deleteProject(
    params: Record<string, string> = {},
  ): Promise<void> {
    try {
      await networkUtils.processPostRequest(this.authOptions, this.getRoute('projects', 'delete', params))
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async listProjects(
    params: Record<string, string> = {},
    queryParams: Record<string, any> = {},
  ): Promise<any> {
    try {
      const response = await networkUtils.processGetRequest(this.authOptions, this.getRoute('projects', 'list', params, queryParams))
      return response
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async getProject(
    params: Record<string, string> = {},
    queryParams: Record<string, any> = {},
  ): Promise<GetProjectResponseData> {
    try {
      const response = await networkUtils.processGetRequest<GetProjectResponseData>(this.authOptions, this.getRoute('projects', 'get', params, queryParams))
      const validatedResponse = this.validateData(GetProjectResponseDataSchema, response, 'project')
      return validatedResponse
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async createSection(
    sectionData: CreateSectionInput,
    params: Record<string, string> = {},
  ): Promise<CreateSectionResponseData> {
    const validatedData = this.validateData(CreateSectionSchema, sectionData, 'section')

    try {
      const response = await networkUtils.processPostRequest<CreateSectionResponseData>(this.authOptions, this.getRoute('sections', 'create', params), {
        json: validatedData,
      })
      const validatedResponse = this.validateData(CreateSectionResponseDataSchema, response, 'section')

      return validatedResponse
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`TestRail section creation failed: ${String(error)}`)
    }
  }

  async createSuite(
    suiteData: CreateSuiteInput,
    params: Record<string, string> = {},
  ): Promise<CreateSuiteResponseData> {
    const validatedData = this.validateData(CreateSuiteSchema, suiteData, 'suite')

    try {
      const response = await networkUtils.processPostRequest<CreateSuiteResponseData>(this.authOptions, this.getRoute('suites', 'create', params), {
        json: validatedData,
      })
      const validatedResponse = this.validateData(CreateSuiteResponseDataSchema, response, 'suite')

      return validatedResponse
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`TestRail suite creation failed: ${String(error)}`)
    }
  }

  async createCase(
    caseData: CreateCaseInput,
    params: Record<string, string> = {},
  ): Promise<any> {
    const validatedData = this.validateData(CreateCaseSchema, caseData, 'test case')

    try {
      const response = await networkUtils.processPostRequest(this.authOptions, this.getRoute('cases', 'create', params), {
        json: validatedData,
      })

      return response
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`TestRail test case creation failed: ${String(error)}`)
    }
  }

  async createResult(
    resultData: CreateResultInput,
    params: Record<string, string> = {},
  ): Promise<any> {
    const validatedData = this.validateData(CreateResultSchema, resultData, 'result')

    try {
      return await networkUtils.processPostRequest(this.authOptions, this.getRoute('results', 'create', params), {
        json: validatedData,
      })
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`TestRail test result creation failed: ${String(error)}`)
    }
  }

  async createRun(
    runData: CreateRunInput,
    params: Record<string, string> = {},
  ): Promise<any> {
    const validatedData = this.validateData(CreateRunSchema, runData, 'run')

    try {
      const response = await networkUtils.processPostRequest(this.authOptions, this.getRoute('runs', 'create', params), {
        json: validatedData,
      })
      return response
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`TestRail test run creation failed: ${String(error)}`)
    }
  }

  async getSuiteID(
    data: RunData,
    params: Record<string, string>,
    callbacks: TRProgressCallbacks = {},
  ): Promise<any> {
    try {
      const { onStart, onSuccess } = callbacks
      onStart?.('Checking project mode two')
      const project = await this.getProject({ project_id: params.project_id })
      onSuccess?.('Project mode checked successfully')

      let suiteId = 0
      if (project.suite_mode === TestRailClient.SUITE_MODE.MULTIPLE_SUITES) {
        onStart?.('Creating test suite')
        const suite = await this.createSuite({ name: data.root.name }, { project_id: params.project_id })
        suiteId = suite.id
        onSuccess?.('Test suite created successfully')
      }
      else {
        onStart?.('Getting test suites')
        const response = await networkUtils.processGetRequest<GetSuitesResponseData>(this.authOptions, this.getRoute('suites', 'get_suites', params))
        const validatedResponse = this.validateData(GetSuitesResponseDataSchema, response, 'suites')
        suiteId = validatedResponse.suites[0].id
        onSuccess?.('Test suites retrieved successfully')
      }
      return suiteId
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`TestRail test get suite id failed: ${String(error)}`)
    }
  }

  async submitTestResults(
    runData: RunData,
    params: Record<string, string>,
    runName: string,
    requestOptions: any = {
      batchOptions: {
        concurrencyLimit: 5,
        throttleLimit: 10,
        throttleInterval: 1000,
      },
      retryAttempts: 3,
      timeout: 30000,
    },
    callbacks: TRProgressCallbacks = {},
  ): Promise<void> {
    const { onStart, onSuccess, onError, onProgress } = callbacks
    const testResultsData = transformXmlDataToTestRail(runData as XmlData)
    const validatedData = this.validateData(TestResultsSchema, testResultsData, 'test results')
    const suiteId = await this.getSuiteID(runData, params, callbacks)
    try {
      const sections = validatedData.sections || []
      const sectionIdMap = new Map()
      const sectionRequests = sections.map((section: { name: string, id: string, [key: string]: any }) => {
        return async () => {
          const response = await this.createSection({
            name: section.name,
            suite_id: suiteId || null,
          }, params)

          if (section.id && response.id) {
            sectionIdMap.set(section.id, response.id)
          }
          return response
        }
      })

      const batchResult1 = await processBatchedRequests(
        sectionRequests,
        requestOptions.batchOptions,
        {
          retry: requestOptions.retryAttempts,
          retryDelay: 1000,
          timeout: requestOptions.timeout,
          showProgress: true,
          progressLabel: 'sections',
          onProgress: onProgress ? (current, total) => onProgress(current, total, 'sections') : undefined,
        },
      )

      if (batchResult1) {
        onSuccess?.(`${sectionIdMap.size} sections created successfully`)
      }
      else {
        onError?.('Error creating sections')
        throw new Error('Failed to create sections')
      }

      const testCases = validatedData.cases || []

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
          const response = await this.createCase({
            title: testCase.title || testCase.name,
          }, { section_id: testCase.section_id })

          let result: Record<string, any>
          if (response && typeof response.json === 'function') {
            result = await response.json()
          }
          else {
            result = response as Record<string, any>
          }

          if (testCase.id && response.id) {
            casesIdMap.set(testCase.id, result.id)
          }

          return result
        }
      })

      const batchResult = await processBatchedRequests(
        requests,
        requestOptions.batchOptions,
        {
          retry: requestOptions.retryAttempts,
          retryDelay: 1000,
          timeout: requestOptions.timeout,
          showProgress: true,
          progressLabel: 'test cases',
          onProgress: onProgress ? (current, total) => onProgress(current, total, 'test cases') : undefined,
        },
      )

      if (batchResult) {
        for (const result of batchResult) {
          if (result && result.id) {
            caseIds.push(result.id)
          }
        }
        onSuccess?.('Test cases created successfully')
      }
      else {
        onError?.('Error creating test cases')
        throw new Error('Failed to create test cases')
      }

      const run = {
        name: runName,
        case_ids: caseIds,
        include_all: false,
        suite_id: suiteId || null,
      }

      onStart?.('Creating test run')
      const testRun = await this.createRun(run, params)
      onSuccess?.('Test run created successfully')

      const testResults = validatedData.results || []
      testResults.forEach((testResult: any) => {
        if (testResult.case_id && casesIdMap.has(testResult.case_id)) {
          testResult.case_id = casesIdMap.get(testResult.case_id)
        }
        else if (casesIdMap.has('default')) {
          testResult.case_id = casesIdMap.get('default')
        }
      })

      onStart?.('Creating test results')
      await this.createResult({ results: testResults }, {
        run_id: testRun.id,
      })
      onSuccess?.('Test results created successfully')
    }
    catch (error) {
      onError?.('Operation failed', error instanceof Error ? error : new Error(String(error)))
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }
}
