import type { z } from 'zod'
import type { CreateCaseInput, CreateFolderInput, CreateMilestoneInput, CreateProjectInput, CreateProjectOutput, CreateTestRunInput, UpdateFolderInput } from '../schemas/testfiesta'
import type { TestFiestaClientOptions } from '../types/type'
import type { AuthOptions, GetResponseData } from '../utils/network'
import type { Result } from '../utils/result'
import { createCaseInputSchema, createFolderInputSchema, createMilestoneInputSchema, createProjectInputSchema, createProjectOutputSchema, createTestRunInputSchema, updateFolderInputSchema } from '../schemas/testfiesta'
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

interface GetCasesOptions extends PaginationOptions {
}

interface GetMilestonesOptions extends PaginationOptions {
}

interface GetFoldersOptions extends PaginationOptions {
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
      LIST: '/projects/{projectKey}/runs?limit={limit}&offset={offset}',
      CREATE: '/projects/{projectKey}/runs',
      GET: '/projects/{projectKey}/runs/{runId}',
      UPDATE: '/projects/{projectKey}/runs/{runId}',
      DELETE: '/projects/{projectKey}/runs/{runId}',
    },
    MILESTONES: {
      LIST: '/projects/{projectKey}/milestones?limit={limit}&offset={offset}',
      CREATE: '/projects/{projectKey}/milestones',
      GET: '/projects/{projectKey}/milestones/{milestoneId}',
      UPDATE: '/projects/{projectKey}/milestones/{milestoneId}',
      DELETE: '/projects/{projectKey}/milestones/{milestoneId}',
    },
    CASES: {
      LIST: '/projects/{projectKey}/cases?limit={limit}&offset={offset}',
      GET: '/projects/{projectKey}/cases/{uid}',
      CREATE: '/projects/{projectKey}/cases',
    },
    FOLDERS: {
      LIST: '/projects/{projectKey}/folders?limit={limit}&offset={offset}',
      GET: '/projects/{projectKey}/folders/{folderId}',
      CREATE: '/projects/{projectKey}/folders',
      UPDATE: '/projects/{projectKey}/folders/{folderId}',
      DELETE: '/projects/{projectKey}/folders/{folderId}',
    },
  } as const

  private static readonly ROUTE_MAP = {
    projects: TestFiestaClient.ROUTES.PROJECTS,
    runs: TestFiestaClient.ROUTES.RUNS,
    milestones: TestFiestaClient.ROUTES.MILESTONES,
    ingress: TestFiestaClient.ROUTES.INGRESS,
    cases: TestFiestaClient.ROUTES.CASES,
    folders: TestFiestaClient.ROUTES.FOLDERS,
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
      cases: TestFiestaClient.ROUTES.CASES,
      folders: TestFiestaClient.ROUTES.FOLDERS,
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
    runId: number,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('runs', 'get', { projectKey, runId: runId.toString() }),
      )
    }, 'Get run')
  }

  async updateRun(
    projectKey: string,
    runId: number,
    updateData: any,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processPutRequest(
        this.authOptions,
        this.getRoute('runs', 'update', { projectKey, runId: runId.toString() }),
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
    options: GetMilestonesOptions = {},
  ): Promise<any> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('milestones', 'list', { projectKey }, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
    }, 'Get milestones')
  }

  async getMilestone(
    projectKey: string,
    milestoneId: number,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('milestones', 'get', { projectKey, milestoneId: milestoneId.toString() }),
      )
    }, 'Get milestone')
  }

  async updateMilestone(
    projectKey: string,
    milestoneId: number,
    updateData: any,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processPutRequest(
        this.authOptions,
        this.getRoute('milestones', 'update', { projectKey, milestoneId: milestoneId.toString() }),
        { body: updateData },
      )
    }, 'Update milestone')
  }

  async deleteMilestone(
    projectKey: string,
    milestoneId: number,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processDeleteRequest(
        this.authOptions,
        this.getRoute('milestones', 'delete', { projectKey, milestoneId: milestoneId.toString() }),
      )
    }, 'Delete milestone')
  }

  async getCases(
    projectKey: string,
    options: GetCasesOptions = {},
  ): Promise<any> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('cases', 'list', { projectKey }, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
    }, 'Get cases')
  }

  async getCase(
    projectKey: string,
    uid: number,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('cases', 'get', { projectKey, uid: uid.toString() }),
      )
    }, 'Get case')
  }

  async createCases(projectKey: string, cases: CreateCaseInput[]): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      const processedCases = cases.map(caseData =>
        this.validateData(createCaseInputSchema, caseData, 'case'),
      )

      return await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('cases', 'create', { projectKey }),
        { body: processedCases },
      )
    }, 'Create cases')
  }

  async createCase(projectKey: string, caseData: CreateCaseInput): Promise<any> {
    return this.createCases(projectKey, [caseData])
  }

  async getFolders(
    projectKey: string,
    options: GetFoldersOptions = {},
  ): Promise<any> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('folders', 'list', { projectKey }, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
    }, 'Get folders')
  }

  async getFolder(
    projectKey: string,
    folderId: number,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('folders', 'get', { projectKey, folderId: folderId.toString() }),
      )
    }, 'Get folder')
  }

  async createFolder(
    projectKey: string,
    createFolderDTO: CreateFolderInput,
  ): Promise<any> {
    const folder = this.validateData(createFolderInputSchema, createFolderDTO, 'folder')

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('folders', 'create', { projectKey }),
        { body: folder },
      )
    }, 'Create folder')
  }

  async updateFolder(
    projectKey: string,
    folderId: number,
    updateFolderInput: UpdateFolderInput,
  ): Promise<any> {
    const folder = this.validateData(updateFolderInputSchema, updateFolderInput, 'folder')

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processPutRequest(
        this.authOptions,
        this.getRoute('folders', 'update', { projectKey, folderId: folderId.toString() }),
        { body: folder },
      )
    }, 'Update folder')
  }

  async deleteFolder(
    projectKey: string,
    folderId: number,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processDeleteRequest(
        this.authOptions,
        this.getRoute('folders', 'delete', { projectKey, folderId: folderId.toString() }),
      )
    }, 'Delete folder')
  }

  async submitTestResults(
    projectKey: string,
    filePath: string,
    options: SubmitResultOptions,
    hooks?: TFHooks,
  ): Promise<void> {
    const { onStart, onSuccess } = hooks || {}

    return this.executeWithErrorHandling(async () => {
      onStart?.('Transforming test data')
      const junitXmlParser = new JunitXmlParser({
        xmlToJsMap: {
          suites: 'root',
          suite: 'folders',
          testcase: 'cases',
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
      throw error
    })
  }
}
