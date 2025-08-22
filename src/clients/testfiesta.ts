import type { z } from 'zod'
import type { CreateMilestoneInput, CreateProjectInput, CreateProjectResponseData, CreateTestRunInput } from '../schemas/testfiesta'
import type { TestFiestaClientOptions } from '../types/type'
import type { AuthOptions, GetResponseData } from '../utils/network'
import type { Result } from '../utils/result'
import type { RunData } from '../utils/run-data-loader'
import type { XmlData } from '../utils/xml-transform'
import { createMilestoneInputSchema, createProjectResponseDataSchema, createProjectSchema, createTestRunInputSchema } from '../schemas/testfiesta'
import * as networkUtils from '../utils/network'
import { getRoute as getRouteUtil } from '../utils/route'
import { substituteUrlStrict } from '../utils/url-substitutor'
import { transformXmlDataToTestFiesta } from '../utils/xml-transform'

export interface TFHooks {
  onStart?: (message: string) => void
  onSuccess?: (message: string) => void
  onError?: (message: string, error?: Error) => void
  onProgress?: (current: number, total: number, label: string) => void
}

interface BaseApiOptions {
  projectKey?: string
}

interface SubmitResultOptions {
  runName: string
  projectKey: string
  handle?: string
}

export class TestFiestaClient {
  protected authOptions: AuthOptions
  protected routes: Record<string, Record<string, string>> = {}
  protected domain: string = ''
  protected projectKey: string = ''
  protected organizationHandle: string = ''

  private static readonly BASE_PATH = '/v1/{handle}'
  private static readonly ROUTES = {
    INGRESS: {
      import: '/projects/{projectKey}/data',
    },
    PROJECTS: {
      LIST: '/projects?limit={limit}&offset={offset}',
      CREATE: '/projects',
      DELETE: '/delete_project/{project_id}',
    },
    RUNS: {
      LIST: '/projects/{projectKey}/runs',
      CREATE: '/projects/{projectKey}/runs',
      GET: '/projects/{projectKey}/runs/{run_id}',
      UPDATE: '/projects/{projectKey}/runs/{run_id}',
      DELETE: '/projects/{projectKey}/runs/{run_id}',
    },
    MILESTONES: {
      LIST: '/projects/{projectKey}/milestones',
      CREATE: '/projects/{projectKey}/milestones',
      GET: '/projects/{projectKey}/milestones/{milestone_id}',
      UPDATE: '/projects/{projectKey}/milestones/{milestone_id}',
      DELETE: '/projects/{projectKey}/milestones/{milestone_id}',
    },
  } as const

  constructor(options: TestFiestaClientOptions) {
    this.authOptions = {
      type: 'api_key',
      location: 'header',
      key: 'Authorization',
      payload: `Bearer ${options.apiKey}`,
    }
    this.domain = options.domain
    this.projectKey = options.projectKey || ''
  }

  private buildRoute(route: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const fullRoute = `${this.domain}${TestFiestaClient.BASE_PATH}${route}`
    return substituteUrlStrict(fullRoute, { ...params, ...queryParams, ...({ projectKey: this.projectKey }), handle: this.organizationHandle })
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
      projects: TestFiestaClient.ROUTES.PROJECTS,
      runs: TestFiestaClient.ROUTES.RUNS,
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
    params: Record<string, string> = {},
    createProjectInput: CreateProjectInput,
  ): Promise<CreateProjectResponseData> {
    const project = this.validateData(createProjectSchema, createProjectInput, 'project')
    try {
      const response = await networkUtils.processPostRequest(this.authOptions, this.getRoute('projects', 'create', params), {
        json: project,
      })
      const validatedResponse = this.validateData(createProjectResponseDataSchema, response, 'project')
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

  async getProjects(
    params: Record<string, string> = {},
    queryParams: Record<string, any> = {},
  ): Promise<Result<GetResponseData, Error>> {
    try {
      return await networkUtils.processGetRequest(this.authOptions, this.getRoute('projects', 'list', params, queryParams))
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async createRun(
    createTestRunInput: CreateTestRunInput,
    options?: BaseApiOptions,
  ) {
    const testRun = this.validateData(createTestRunInputSchema, createTestRunInput, 'test run')
    try {
      const params = (options as any) || { projectKey: this.projectKey }
      return await networkUtils.processPostRequest(this.authOptions, this.getRoute('runs', 'create', params), {
        json: testRun,
      })
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async updateRun(input: any, options?: BaseApiOptions) {
    try {
      const params = (options as any) || { projectKey: this.projectKey }
      await networkUtils.processPutRequest(this.authOptions, this.getRoute('runs', 'update', params), {
        json: input,
      })
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async getMilestones(params: Record<string, string> = {}) {
    try {
      return await networkUtils.processGetRequest(this.authOptions, this.getRoute('milestones', 'list', params))
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async createMilestone(createMilestoneInput: CreateMilestoneInput, options?: BaseApiOptions) {
    const milestone = this.validateData(createMilestoneInputSchema, createMilestoneInput, 'milestone')
    try {
      return await networkUtils.processPostRequest(this.authOptions, this.getRoute('milestones', 'create', (options as any) || { projectKey: this.projectKey }), {
        json: milestone,
      })
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async updateMilestone(params: Record<string, string> = {}) {
    try {
      await networkUtils.processPostRequest(this.authOptions, this.getRoute('milestones', 'update', params))
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async deleteMilestone(params: Record<string, string> = {}) {
    try {
      await networkUtils.processDeleteRequest(this.authOptions, this.getRoute('milestones', 'delete', params))
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async submitTestResults(
    runData: RunData,
    options: SubmitResultOptions,
    hooks?: TFHooks,
  ): Promise<void> {
    const { onStart, onSuccess, onError } = hooks || {}

    try {
      onStart?.('Transforming test data')
      const transformedData = transformXmlDataToTestFiesta(runData as XmlData)
      transformedData.entities.runs!.entries[0].name = options.runName

      onSuccess?.('Test data transformed successfully')

      onStart?.('Submitting test results to TestFiesta')
      await networkUtils.processPostRequest(this.authOptions, this.getRoute('ingress', 'import', options as any), {
        json: transformedData,
      })
      onSuccess?.('Test results submitted successfully')
    }
    catch (error) {
      onError?.('Failed to submit test results', error instanceof Error ? error : new Error(String(error)))
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }
}
