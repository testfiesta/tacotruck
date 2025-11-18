import type { z } from 'zod'
import type { CreateCaseInput, CreateCustomFieldInput, CreateFolderInput, CreateMilestoneInput, CreateProjectInput, CreateProjectOutput, CreateTagInput, CreateTemplateInput, CreateTestRunInput, CustomFieldListResponse, CustomFieldResponse, TemplateListResponse, TemplateResponse, UpdateCustomFieldInput, UpdateFolderInput, UpdateTagInput, UpdateTemplateInput } from '../schemas/testfiesta'
import type { TestFiestaClientOptions } from '../types'

import type { AuthOptions, GetResponseData } from '../utils/network'
import type { Result } from '../utils/result'
import { Buffer } from 'node:buffer'
import * as crypto from 'node:crypto'
import { glob } from 'tinyglobby'
import { createCaseInputSchema, createCustomFieldInputSchema, createFolderInputSchema, createMilestoneInputSchema, createProjectInputSchema, createProjectOutputSchema, createTagInputSchema, createTemplateInputSchema, createTestRunInputSchema, customFieldListResponseSchema, customFieldResponseSchema, templateListResponseSchema, templateResponseSchema, updateCustomFieldInputSchema, updateFolderInputSchema, updateTagInputSchema, updateTemplateInputSchema } from '../schemas/testfiesta'
import { JunitXmlParser } from '../utils/junit-xml-parser'
import * as networkUtils from '../utils/network'
import { getRoute as getRouteUtil } from '../utils/route'
import { substituteUrlStrict } from '../utils/url-substitutor'

export interface TFHooks {
  onStart?: (message: string) => void
  onSuccess?: (message: string) => void
  onError?: (message: string, error?: Error) => void
  onProgress?: (current: number, total: number, label: string) => void
  onBeforeRunCreated?: (runName: string) => void
  onAfterRunCreated?: (run: any) => void | Promise<void>
}

interface SubmitResultOptions {
  runName: string
  source?: string
  runUid: number
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

interface GetTagsOptions extends PaginationOptions {
}

interface GetTemplatesOptions extends PaginationOptions {
}

export interface SignedUrlFileDescriptor {
  fileName: string
  fileType: string
  size: number
  mediaType?: 'attachment'
  externalId: string
  runId: number
}

export interface SignedUrlFileResult {
  fileName: string
  signedUrl: string
  objectUrl: string
  key: string
  clientHeaders: Record<string, string>
  storagePath: string
  externalId?: string
}

export interface SignedUrlBatchResponse {
  files: SignedUrlFileResult[]
}

export class TestFiestaClient {
  protected authOptions: AuthOptions
  protected routes: Record<string, Record<string, string>> = {}
  protected baseUrl: string = ''
  protected organizationHandle: string = ''

  private static readonly BASE_PATH = '/v1/{handle}'
  private static readonly DEFAULT_BASE_URL = 'https://api.testfiesta.com'
  private static readonly ROUTES = {
    INGRESS: {
      IMPORT: '/projects/{projectKey}/data',
      SIGNED_URL: '/projects/{projectKey}/data/signed-url',
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
    TAGS: {
      LIST: '/tags?limit={limit}&offset={offset}',
      CREATE: '/tags',
      GET: '/tags/{tagId}',
      UPDATE: '/tags/{tagId}',
      DELETE: '/tags/{tagId}',
    },
    TEMPLATES: {
      LIST: '/projects/{projectKey}/templates?limit={limit}&offset={offset}',
      GET: '/projects/{projectKey}/templates/{templateId}',
      CREATE: '/projects/{projectKey}/templates',
      UPDATE: '/projects/{projectKey}/templates/{templateId}',
      DELETE: '/projects/{projectKey}/templates/{templateId}',
    },
    CUSTOM_FIELDS: {
      LIST: '/projects/{projectKey}/customFields?limit={limit}&offset={offset}',
      GET: '/projects/{projectKey}/customFields/{customFieldId}',
      CREATE: '/projects/{projectKey}/customFields',
      UPDATE: '/projects/{projectKey}/customFields/{customFieldId}',
      DELETE: '/projects/{projectKey}/customFields/{customFieldId}',
    },
  } as const

  private static readonly ROUTE_MAP = {
    projects: TestFiestaClient.ROUTES.PROJECTS,
    runs: TestFiestaClient.ROUTES.RUNS,
    milestones: TestFiestaClient.ROUTES.MILESTONES,
    ingress: TestFiestaClient.ROUTES.INGRESS,
    cases: TestFiestaClient.ROUTES.CASES,
    folders: TestFiestaClient.ROUTES.FOLDERS,
    tags: TestFiestaClient.ROUTES.TAGS,
    templates: TestFiestaClient.ROUTES.TEMPLATES,
    customFields: TestFiestaClient.ROUTES.CUSTOM_FIELDS,
  } as const

  constructor(options: TestFiestaClientOptions) {
    this.authOptions = {
      type: 'api_key',
      location: 'header',
      key: 'Authorization',
      payload: `Bearer ${options.apiKey}`,
    }
    this.baseUrl = options.baseUrl || TestFiestaClient.DEFAULT_BASE_URL
    this.organizationHandle = options.organizationHandle
  }

  private buildRoute(route: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const fullRoute = `${this.baseUrl}${TestFiestaClient.BASE_PATH}${route}`
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
      tags: TestFiestaClient.ROUTES.TAGS,
      templates: TestFiestaClient.ROUTES.TEMPLATES,
      customFields: TestFiestaClient.ROUTES.CUSTOM_FIELDS,
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
      await networkUtils.processPatchRequest(
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

  async getTags(
    options: GetTagsOptions = {},
  ): Promise<any> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('tags', 'list', {}, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
    }, 'Get tags')
  }

  async getTag(
    tagId: number,
  ): Promise<any> {
    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('tags', 'get', { tagId: tagId.toString() }),
      )
    }, 'Get tag')
  }

  async createTag(
    createTagInput: CreateTagInput,
  ): Promise<any> {
    const tag = this.validateData(createTagInputSchema, createTagInput, 'tag')

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('tags', 'create'),
        { body: tag },
      )
    }, 'Create tag')
  }

  async updateTag(
    tagId: number,
    updateTagInput: UpdateTagInput,
  ): Promise<any> {
    const tag = this.validateData(updateTagInputSchema, updateTagInput, 'tag')

    return this.executeWithErrorHandling(async () => {
      return await networkUtils.processPutRequest(
        this.authOptions,
        this.getRoute('tags', 'update', { tagId: tagId.toString() }),
        { body: tag },
      )
    }, 'Update tag')
  }

  async deleteTag(
    tagId: number,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processDeleteRequest(
        this.authOptions,
        this.getRoute('tags', 'delete', { tagId: tagId.toString() }),
      )
    }, 'Delete tag')
  }

  async getTemplates(
    projectKey: string,
    options: GetTemplatesOptions = {},
  ): Promise<TemplateListResponse> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('templates', 'list', { projectKey }, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
      return this.validateData(templateListResponseSchema, response, 'template list response')
    }, 'Get templates')
  }

  async getTemplate(
    projectKey: string,
    templateId: number,
  ): Promise<TemplateResponse> {
    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('templates', 'get', { projectKey, templateId: templateId.toString() }),
      )
      return this.validateData(templateResponseSchema, response, 'template response')
    }, 'Get template')
  }

  async createTemplate(
    projectKey: string,
    createTemplateInput: CreateTemplateInput,
  ): Promise<TemplateResponse> {
    const template = this.validateData(createTemplateInputSchema, createTemplateInput, 'template')
    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('templates', 'create', { projectKey }),
        { body: template },
      )
      return this.validateData(templateResponseSchema, response, 'template response')
    }, 'Create template')
  }

  async updateTemplate(
    projectKey: string,
    templateId: number,
    updateTemplateInput: UpdateTemplateInput,
  ): Promise<TemplateResponse> {
    const template = this.validateData(updateTemplateInputSchema, updateTemplateInput, 'template')

    return this.executeWithErrorHandling(async () => {
      const url = this.getRoute('templates', 'update', { projectKey, templateId: templateId.toString() })

      const response = await networkUtils.processPatchRequest(
        this.authOptions,
        url,
        { body: template },
      )
      return this.validateData(templateResponseSchema, response, 'template response')
    }, 'Update template')
  }

  async deleteTemplate(
    projectKey: string,
    templateId: number,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processDeleteRequest(
        this.authOptions,
        this.getRoute('templates', 'delete', { projectKey, templateId: templateId.toString() }),
      )
    }, 'Delete template')
  }

  async getCustomFields(
    projectKey: string,
    options: PaginationOptions = {},
  ): Promise<CustomFieldListResponse> {
    const { limit = 10, offset = 0 } = options

    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('customFields', 'list', { projectKey }, {
          limit: limit.toString(),
          offset: offset.toString(),
        }),
      )
      return this.validateData(customFieldListResponseSchema, response, 'custom field list response')
    }, 'Get custom fields')
  }

  async getCustomField(
    projectKey: string,
    customFieldId: string,
  ): Promise<CustomFieldResponse> {
    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processGetRequest(
        this.authOptions,
        this.getRoute('customFields', 'get', { projectKey, customFieldId }),
      )
      return this.validateData(customFieldResponseSchema, response, 'custom field response')
    }, 'Get custom field')
  }

  async createCustomField(
    projectKey: string,
    createCustomFieldInput: CreateCustomFieldInput,
  ): Promise<CustomFieldResponse> {
    const customField = this.validateData(createCustomFieldInputSchema, createCustomFieldInput, 'custom field')

    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('customFields', 'create', { projectKey }),
        { body: customField },
      )
      return this.validateData(customFieldResponseSchema, response, 'custom field response')
    }, 'Create custom field')
  }

  async updateCustomField(
    projectKey: string,
    customFieldId: string,
    updateCustomFieldInput: UpdateCustomFieldInput,
  ): Promise<CustomFieldResponse> {
    const customField = this.validateData(updateCustomFieldInputSchema, updateCustomFieldInput, 'custom field')

    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processPutRequest(
        this.authOptions,
        this.getRoute('customFields', 'update', { projectKey, customFieldId }),
        { body: customField },
      )
      return this.validateData(customFieldResponseSchema, response, 'custom field response')
    }, 'Update custom field')
  }

  async deleteCustomField(
    projectKey: string,
    customFieldId: string,
  ): Promise<void> {
    return this.executeWithErrorHandling(async () => {
      await networkUtils.processDeleteRequest(
        this.authOptions,
        this.getRoute('customFields', 'delete', { projectKey, customFieldId }),
      )
    }, 'Delete custom field')
  }

  async getSignedUrls(
    projectKey: string,
    files: SignedUrlFileDescriptor[],
  ): Promise<SignedUrlBatchResponse> {
    return this.executeWithErrorHandling(async () => {
      const response = await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('ingress', 'signed_url', { projectKey }),
        { body: { files } },
      )
      return response as SignedUrlBatchResponse
    }, 'Get signed URLs')
  }

  async submitTestResults(
    projectKey: string,
    filePathOrPattern: string,
    options: SubmitResultOptions,
    hooks?: TFHooks,
  ): Promise<void> {
    const { onStart, onSuccess, onProgress } = hooks || {}

    return this.executeWithErrorHandling(async () => {
      onStart?.('Resolving file patterns')

      const filePaths = await glob([filePathOrPattern], {
        onlyFiles: true,
        absolute: true,
      })

      if (filePaths.length === 0) {
        throw new Error(`No files found matching pattern: ${filePathOrPattern}`)
      }

      onSuccess?.(`Found ${filePaths.length} file(s) to process`)

      const sharedRunId = crypto.randomUUID()

      const combinedResults = {
        folders: [] as any[],
        cases: [] as any[],
        executions: [] as any[],
      }
      const filesToSign: SignedUrlFileDescriptor[] = []
      const contentByKey = new Map<string, { content: string, fileType: string }>()
      const makeKey = (externalId: string, fileName: string) => `${externalId}::${fileName}`

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]
        onProgress?.(i + 1, filePaths.length, `Processing ${filePath}`)

        const junitXmlParser = new JunitXmlParser({
          xmlToJsMap: {
            suites: 'root',
            suite: 'folders',
            testcase: 'cases',
          },
          runId: sharedRunId,
        })

        const results = junitXmlParser.fromFile(filePath).build()

        combinedResults.folders.push(...results.folders)
        combinedResults.cases.push(...results.cases)
        combinedResults.executions.push(...results.executions)
        if (Array.isArray(results.cases)) {
          for (const tc of results.cases as any[]) {
            const caseExternalId: string = tc.externalId || ''
            if (typeof tc['system-out'] === 'string' && tc['system-out'].length > 0) {
              filesToSign.push({
                fileName: 'system-out.txt',
                fileType: 'text/plain; charset=utf-8',
                size: Buffer.byteLength(tc['system-out'], 'utf8'),
                externalId: caseExternalId,
                mediaType: 'attachment',
                runId: options.runUid,
              })
              contentByKey.set(makeKey(caseExternalId, 'system-out.txt'), { content: tc['system-out'], fileType: 'text/plain; charset=utf-8' })
            }

            if (typeof tc['system-err'] === 'string' && tc['system-err'].length > 0) {
              filesToSign.push({
                fileName: 'system-err.txt',
                fileType: 'text/plain; charset=utf-8',
                size: Buffer.byteLength(tc['system-err'], 'utf8'),
                mediaType: 'attachment',
                externalId: caseExternalId,
                runId: options.runUid,
              })
              contentByKey.set(makeKey(caseExternalId, 'system-err.txt'), { content: tc['system-err'], fileType: 'text/plain; charset=utf-8' })
            }

            if (tc.failure && (tc.failure.message || tc.failure.type || tc.failure._text)) {
              const failureJson = JSON.stringify({
                message: tc.failure.message || '',
                type: tc.failure.type || '',
                text: typeof tc.failure._text === 'string' ? tc.failure._text : '',
              })
              filesToSign.push({
                fileName: 'failure-data.json',
                fileType: 'application/json; charset=utf-8',
                size: Buffer.byteLength(failureJson, 'utf8'),
                mediaType: 'attachment',
                externalId: caseExternalId,
                runId: options.runUid,
              })
              contentByKey.set(makeKey(caseExternalId, 'failure-data.json'), { content: failureJson, fileType: 'application/json; charset=utf-8' })
            }

            if (tc.error && (tc.error.message || tc.error.type || tc.error._text)) {
              const errorJson = JSON.stringify({
                message: tc.error.message || '',
                type: tc.error.type || '',
                text: typeof tc.error._text === 'string' ? tc.error._text : '',
              })
              filesToSign.push({
                fileName: 'error-data.json',
                fileType: 'application/json; charset=utf-8',
                size: Buffer.byteLength(errorJson, 'utf8'),
                mediaType: 'attachment',
                externalId: caseExternalId,
                runId: options.runUid,
              })
              contentByKey.set(makeKey(caseExternalId, 'error-data.json'), { content: errorJson, fileType: 'application/json; charset=utf-8' })
            }
          }
        }
      }

      onSuccess?.('Test data transformed successfully')

      if (filesToSign.length > 0) {
        onStart?.('Uploading attachments to TestFiesta')

        const { files: signedFiles } = await this.getSignedUrls(projectKey, filesToSign)

        for (let i = 0; i < signedFiles.length; i++) {
          const f: any = signedFiles[i]
          const keyFromResult = (f.externalId || f.external_id) ? makeKey(f.externalId || f.external_id, f.fileName) : undefined
          let mapped = keyFromResult ? contentByKey.get(keyFromResult) : undefined
          if (!mapped) {
            const candidates = Array.from(contentByKey.entries()).filter(([k]) => k.endsWith(`::${f.fileName}`))
            if (candidates.length === 1)
              mapped = candidates[0][1]
          }
          if (!mapped)
            continue

          await networkUtils.processPutRequest<any>(
            null,
            f.signedUrl,
            {
              body: mapped.content as unknown as any,
              headers: {
                ...(f.clientHeaders || {}),
                'Content-Type': mapped.fileType,
              },
            },
          )
        }
        onSuccess?.('Attachments uploaded successfully')
      }

      const _payload = {
        entities: {
          folders: { entries: combinedResults.folders },
          cases: { entries: combinedResults.cases },
          executions: { entries: combinedResults.executions },
          runs: { entries: [{
            name: options.runName,
            source: options.source,
            externalId: sharedRunId,
            customFields: {
              externalId: sharedRunId,
            },
          }] },
        },
        runId: options.runUid,

      }

      onStart?.('Submitting test results to TestFiesta')
      await networkUtils.processPostRequest(
        this.authOptions,
        this.getRoute('ingress', 'import', { projectKey }),
        { body: _payload },
      )
      onSuccess?.('Test results submitted successfully')
    }, 'Submit test results').catch((error) => {
      throw error
    })
  }
}
