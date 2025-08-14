import type { z } from 'zod'
import type { CreateProjectInput, CreateProjectResponseData } from '../schemas/testfiesta'
import type { TestFiestaClientOptions } from '../types/type'
import type { AuthOptions, GetResponseData } from '../utils/network'
import type { Result } from '../utils/result'
import type { TransformedTestFiestaData } from '../utils/xml-transform'
import { createProjectResponseDataSchema, createProjectSchema } from '../schemas/testfiesta'
import * as networkUtils from '../utils/network'
import { getRoute as getRouteUtil } from '../utils/route'
import { substituteUrlStrict } from '../utils/url-substitutor'

export class TestFiestaClient {
  protected authOptions: AuthOptions
  protected routes: Record<string, Record<string, string>> = {}
  protected domain: string = ''

  private static readonly BASE_URL = '/v1/{handle}'
  private static readonly ROUTES = {
    PROJECTS: {
      LIST: '/projects?limit={limit}&offset={offset}',
      CREATE: '/projects',
      DELETE: '/delete_project/{project_id}',
      DATA: '/projects/{key}/data',
    },
    RUNS: {
      LIST: '/runs',
      CREATE: '/runs',
      GET: '/runs/{run_id}',
      UPDATE: '/runs/{run_id}',
      DELETE: '/runs/{run_id}',
    },
    RESULTS: {
      LIST: '/results',
      CREATE: '/results',
      GET: '/results/{result_id}',
      UPDATE: '/results/{result_id}',
      DELETE: '/results/{result_id}',
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
  }

  private buildRoute(route: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const fullRoute = `${this.domain}${TestFiestaClient.BASE_URL}${route}`
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
      projects: TestFiestaClient.ROUTES.PROJECTS,
      runs: TestFiestaClient.ROUTES.RUNS,
      results: TestFiestaClient.ROUTES.RESULTS,
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

  async submitTestResults(
    transformedData: TransformedTestFiestaData,
    params: Record<string, string> = {},
  ): Promise<void> {
    try {
      console.log('transformedData', JSON.stringify(transformedData, null, 2))
      console.log(this.getRoute('projects', 'data', params))

      await networkUtils.processPostRequest(this.authOptions, this.getRoute('projects', 'data', params), {
        json: transformedData,
      })
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }
}
