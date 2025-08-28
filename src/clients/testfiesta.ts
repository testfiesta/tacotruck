import type { z } from 'zod'
import type { CreateMilestoneInput, CreateProjectInput, CreateProjectOutput, CreateTestRunInput } from '../schemas/testfiesta'
import type { TestFiestaClientOptions } from '../types/type'
import type { AuthOptions, GetResponseData } from '../utils/network'
import type { Result } from '../utils/result'
// import { randomUUID } from 'node:crypto'
import { createMilestoneInputSchema, createProjectInputSchema, createProjectOutputSchema, createTestRunInputSchema } from '../schemas/testfiesta'
import { JunitXmlParser } from '../utils/junit-xml-parser'
import * as networkUtils from '../utils/network'
import { getRoute as getRouteUtil } from '../utils/route'
import { substituteUrlStrict } from '../utils/url-substitutor'

export interface TFHooks {
  onStart?: (message: string) => void
  onSuccess?: (message: string) => void
  onError?: (message: string, error?: Error) => void
  onProgress?: (current: number, total: number, label: string) => void
}

interface SubmitResultOptions {
  runName: string
}

interface PaginationOptions {
  limit?: number
  offset?: number
}

interface GetProjectsOptions extends PaginationOptions {
}

interface GetRunsOptions extends PaginationOptions {
}

export class TestFiestaClient {
  protected authOptions: AuthOptions
  protected routes: Record<string, Record<string, string>> = {}
  protected domain: string = ''
  protected organizationHandle: string = ''

  private static readonly BASE_PATH = '/v1/{handle}'
  private static readonly ROUTES = {
    INGRESS: {
      IMPORT: '/projects/{projectKey}/data',
    },
    PROJECTS: {
      LIST: '/projects?limit={limit}&offset={offset}',
      CREATE: '/projects',
      DELETE: '/delete_project/{project_id}',
    },
    RUNS: {
      LIST: '/projects/{projectKey}/runs',
      CREATE: '/projects/{projectKey}/runs',
      GET: '/projects/{projectKey}/runs/{runId}',
      UPDATE: '/projects/{projectKey}/runs/{runId}',
      DELETE: '/projects/{projectKey}/runs/{runId}',
    },
    MILESTONES: {
      LIST: '/projects/{projectKey}/milestones',
      CREATE: '/projects/{projectKey}/milestones',
      GET: '/projects/{projectKey}/milestones/{milestoneId}',
      UPDATE: '/projects/{projectKey}/milestones/{milestoneId}',
      DELETE: '/projects/{projectKey}/milestones/{milestoneId}',
    },
  } as const

  private static readonly ROUTE_MAP = {
    projects: TestFiestaClient.ROUTES.PROJECTS,
    runs: TestFiestaClient.ROUTES.RUNS,
    milestones: TestFiestaClient.ROUTES.MILESTONES,
    ingress: TestFiestaClient.ROUTES.INGRESS,
  } as const

  constructor(options: TestFiestaClientOptions) {
    this.authOptions = {
      type: 'api_key',
      location: 'header',
      key: 'Authorization',
      payload: `Bearer ${options.apiKey}`,
    }
    this.domain = options.domain
    this.organizationHandle = options.organizationHandle
  }

  private buildRoute(route: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const fullRoute = `${this.domain}${TestFiestaClient.BASE_PATH}${route}`
    return substituteUrlStrict(fullRoute, { ...params, ...queryParams, handle: this.organizationHandle })
  }

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    try {
      return await operation()
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`${context} failed: ${errorMessage}`)
    }
  }

  private validateData<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid ${context} input: ${result.error.message}`)
    }
    return result.data
  }

  public getRoute(resource: keyof typeof TestFiestaClient.ROUTE_MAP, action: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const routeMap = {
      projects: TestFiestaClient.ROUTES.PROJECTS,
      runs: TestFiestaClient.ROUTES.RUNS,
      milestones: TestFiestaClient.ROUTES.MILESTONES,
      ingress: TestFiestaClient.ROUTES.INGRESS,
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
  ): Promise<CreateProjectOutput> {
    const project = this.validateData(createProjectInputSchema, createProjectInput, 'project')

    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('projects', 'create'),
        { body: project },
      )
      return this.validateData(createProjectOutputSchema, response, 'project response')
    }, 'Create project')
  }

  async deleteProject(
    projectKey: string,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processDeleteRequest(
        this.authOptions,
        this.getRoute('projects', 'delete', { projectKey }),
      )
    }, 'Delete project')
  }

  async getProjects(
    options: GetProjectsOptions = {},
  ): Promise<Result<GetResponseData, Error>> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('projects', 'list', {}, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
    }, 'Get projects')
  }

  async createRun(
    projectKey: string,
    createTestRunInput: CreateTestRunInput,
  ): Promise<any> {
    const testRun = this.validateData(createTestRunInputSchema, createTestRunInput, 'test run')

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('runs', 'create', { projectKey }),
        { body: testRun },
      )
    }, 'Create run')
  }

  async getRuns(
    projectKey: string,
     options: GetRunsOptions = {},
  ): Promise<any> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('runs', 'list', { projectKey }, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
    }, 'Get runs')
  }

  async getRun(
    projectKey: string,
    runId: string,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('runs', 'get', { projectKey, runId }),
      )
    }, 'Get run')
  }

  async updateRun(
    projectKey: string,
    runId: string,
    updateData: any,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processPutRequest(
        this.authOptions,
        this.getRoute('runs', 'update', { projectKey, runId }),
        { body: updateData },
      )
    }, 'Update run')
  }

  async createMilestone(
    projectKey: string,
    createMilestoneInput: CreateMilestoneInput,
  ): Promise<any> {
    const milestone = this.validateData(createMilestoneInputSchema, createMilestoneInput, 'milestone')

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('milestones', 'create', { projectKey }),
        { body: milestone },
      )
    }, 'Create milestone')
  }

  async getMilestones(
    projectKey: string,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('milestones', 'list', { projectKey }),
      )
    }, 'Get milestones')
  }

  async getMilestone(
    projectKey: string,
    milestoneId: string,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('milestones', 'get', { projectKey, milestoneId }),
      )
    }, 'Get milestone')
  }

  async updateMilestone(
    projectKey: string,
    milestoneId: string,
    updateData: any,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processPutRequest(
        this.authOptions,
        this.getRoute('milestones', 'update', { projectKey, milestoneId }),
        { body: updateData },
      )
    }, 'Update milestone')
  }

  async deleteMilestone(
    projectKey: string,
    milestoneId: string,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processDeleteRequest(
        this.authOptions,
        this.getRoute('milestones', 'delete', { projectKey, milestoneId }),
      )
    }, 'Delete milestone')
  }

  async submitTestResults(
    projectKey: string,
    filePath: string,
    options: SubmitResultOptions,
    hooks?: TFHooks,
  ): Promise<void> {
    const { onStart, onSuccess, onError } = hooks || {}

    return this.executeWithErrorHandling(async () => {
      onStart?.('Transforming test data')
      const junitXmlParser = new JunitXmlParser({
        xmlToJsMap: {
          suites: 'root',
          suite: 'folders',
          testcase: 'cases',
        },
        statusMap: {
          passed: 1,
          blocked: 2,
          skipped: 4,
          failed: 5,
        },
      })
      const results = junitXmlParser.fromFile(filePath).build()
      onSuccess?.('Test data transformed successfully')

      const payload = {
        entities: {
          folders: { entries: results.folders },
          cases: { entries: results.cases },
          executions: { entries: results.executions },
          runs: { entries: [{
            name: options.runName,
            source: 'junit-xml',
            externalId: results.runId,
            customFields: {
              externalId: results.runId,
            },
          }] },
        },
      }

      onStart?.('Submitting test results to TestFiesta')
      await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('ingress', 'import', { projectKey }),
        { body: payload },
      )
      onSuccess?.('Test results submitted successfully')
    }, 'Submit test results').catch((error) => {
      onError?.('Failed to submit test results', error)
      throw error
    })
  }
}
