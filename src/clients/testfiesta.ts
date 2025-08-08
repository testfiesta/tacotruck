import { z } from 'zod'
import {
  AuthenticationManager,
  ConfigurationManager,
} from '../managers'
import * as networkUtils from '../utils/network'

interface TestFiestaClientOptions {
  baseUrl?: string
  apiKey: string
}

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

export class TestFiestaClient {
  private baseUrl: string
  private apiKey: string
  private configurationManager: ConfigurationManager | null
  protected authManager: AuthenticationManager | null

  constructor(options: TestFiestaClientOptions) {
    this.baseUrl = options.baseUrl ?? ''
    this.apiKey = options.apiKey
    this.configurationManager = null
    this.authManager = null

    this.prepareConfigurationManager()
    this.prepareAuthManager()
  }

  private prepareConfigurationManager() {
    this.configurationManager = new ConfigurationManager({
      name: 'testfiesta',
      type: 'api',
      base_path: 'v1/{handle}',
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
      },
    })

    this.configurationManager.applySubstitutions()
  }

  private prepareAuthManager() {
    if (!this.configurationManager || !this.baseUrl) {
      return
    }
    this.authManager = new AuthenticationManager({
      credentials: this.configurationManager.getCredentials(),
    })
  }

  async createProject(
  ): Promise<void> {
    const result = await networkUtils.processPostRequest(this.authManager!.getAuthOptions(), '/projects')

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
