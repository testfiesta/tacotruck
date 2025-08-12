import type { CreateProjectInput, CreateProjectResponseData } from '../schemas/testfiesta'
import type { TestFiestaClientOptions } from '../types/type'
import type { GetResponseData } from '../utils/network'
import { createProjectResponseDataSchema, createProjectSchema } from '../schemas/testfiesta'
import * as networkUtils from '../utils/network'
import { BaseClient } from './base-client'

export class TestFiestaClient extends BaseClient {
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
    super({ domain: options.domain, baseUrl: TestFiestaClient.BASE_URL })
    this.authOptions = {
      type: 'api_key',
      location: 'header',
      key: 'Authorization',
      payload: `Bearer ${options.apiKey}`,
    }
  }

  protected getRouteMap(): Record<string, Record<string, string>> {
    return {
      projects: TestFiestaClient.ROUTES.PROJECTS,
      runs: TestFiestaClient.ROUTES.RUNS,
      results: TestFiestaClient.ROUTES.RESULTS,
    }
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
  ): Promise<GetResponseData> {
    try {
      return await networkUtils.processGetRequest(this.authOptions, this.getRoute('projects', 'list', params, queryParams))
    }
    catch (error) {
      throw error instanceof Error ? error : new Error(`Request failed: ${String(error)}`)
    }
  }

  async submitTestResults(

  ): Promise<void> {

  }
}
