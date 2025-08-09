import type { AuthOptions, GetResponseData } from '../utils/network'
import type { Result } from '../utils/result'
import { z } from 'zod'
import * as networkUtils from '../utils/network'
import { substituteUrlStrict } from '../utils/url-substitutor'

interface TestFiestaClientOptions {
  apiKey: string
  domain: string
}

export const createProjectSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  customFields: z.object().default({}),
})

type CreateProjectInput = z.infer<typeof createProjectSchema>

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

  public getRoute(resource: string, action: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const routeMap = {
      projects: TestFiestaClient.ROUTES.PROJECTS,
      runs: TestFiestaClient.ROUTES.RUNS,
      results: TestFiestaClient.ROUTES.RESULTS,
    } as const

    const resourceRoutes = routeMap[resource as keyof typeof routeMap]
    if (!resourceRoutes) {
      throw new Error(`Unknown resource: ${resource}`)
    }

    const route = resourceRoutes[action.toUpperCase() as keyof typeof resourceRoutes]
    if (!route) {
      throw new Error(`Unknown action: ${action} for resource: ${resource}`)
    }

    return this.buildRoute(route, params, queryParams)
  }

  async createProject(
    params: Record<string, string> = {},
    createProjectInput: CreateProjectInput,
  ): Promise<void> {
    const project = createProjectSchema.safeParse(createProjectInput)
    if (!project.success) {
      throw new Error(`Invalid project input: ${project.error.message}`)
    }

    try {
      await networkUtils.processPostRequest(this.authOptions, this.getRoute('projects', 'create', params), {
        json: project.data,
      })
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
}
