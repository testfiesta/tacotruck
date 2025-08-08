import { z } from 'zod'
import {
  AuthenticationManager,
  ConfigurationManager,
} from '../managers'
import * as networkUtils from '../utils/network'

interface TestFiestaClientOptions {
  baseUrl: string
  organization: string
  apiKey: string
}

export const createProjectSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  customFields: z.object().default({}),
})

type CreateProjectInput = z.infer<typeof createProjectSchema>

export class TestFiestaClient {
  private baseUrl: string
  private apiKey: string
  private organization: string
  private configurationManager: ConfigurationManager
  protected authManager: AuthenticationManager | null

  constructor(options: TestFiestaClientOptions) {
    this.baseUrl = options.baseUrl ?? ''
    this.apiKey = options.apiKey
    this.organization = options.organization
    this.configurationManager = this.prepareConfigurationManager()
    this.authManager = this.prepareAuthManager()
  }

  private prepareConfigurationManager(): ConfigurationManager {
    const configurationManager = new ConfigurationManager({
      name: 'testfiesta',
      type: 'api',
      base_path: 'v1/{organization}',
      auth: {
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer {apiKey}',
      },
      source: {
        projects: {
          endpoints: {
            index: {
              path: '/projects',
            },
          },
        },
      },
      target: {
        projects: {
          endpoints: {
            create: {
              path: '/projects',
            },
            delete: {
              path: '/delete_project/{project_id}',
            },
          },
        },
      },
    }, {
      allowMutation: true,
      baseUrl: this.baseUrl,
      credentials: {
        apiKey: this.apiKey,
        organization: this.organization,
      },
    })

    configurationManager.applySubstitutions()
    return configurationManager
  }

  private prepareAuthManager() {
    if (!this.configurationManager) {
      return null
    }
    return new AuthenticationManager({
      credentials: this.configurationManager.getCredentials(),
    })
  }

  private getProjectPath() {
    const config = this.configurationManager.getConfig()

    if (!config || !config.target) {
      return ''
    }

    const projectEndpoints = Object.keys(config?.target)

    if (!projectEndpoints || projectEndpoints.length === 0) {
      return ''
    }

    const projectPath = config.target.projects.endpoints.create.path || ''
    return projectPath
  }

  async createProject(
    createProjectInput: CreateProjectInput,
  ) {
    const project = createProjectSchema.safeParse(createProjectInput)
    const result = await networkUtils.processPostRequest(this.authManager!.getAuthOptions(), this.getProjectPath(), {
      json: project,
    })

    return result.match({
      ok: (value: any) => value,
      err: () => {
        throw new Error(`Request to failed`)
      },
    })
  }

  async deleteProject(
  ): Promise<void> {
    const result = await networkUtils.processPostRequest(this.authManager!.getAuthOptions(), '/projects')

    return result.match({
      ok: (value: any) => value,
      err: () => {
        throw new Error(`Request to failed`)
      },
    })
  }

  async getProjects(
  ): Promise<void> {
    const result = await networkUtils.processPostRequest(this.authManager!.getAuthOptions(), '/projects')

    return result.match({
      ok: (value: any) => value,
      err: () => {
        throw new Error(`Request to failed`)
      },
    })
  }
}
