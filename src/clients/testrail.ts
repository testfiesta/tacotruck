import { Buffer } from 'node:buffer'
import { z } from 'zod'
import {
  AuthenticationManager,
  ConfigurationManager,
} from '../managers'
import * as networkUtils from '../utils/network'

interface TestRailClientOptions {
  baseUrl: string
  username: string
  password: string
}

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

export class TestRailClient {
  private baseUrl: string
  private username: string
  private password: string

  private configurationManager: ConfigurationManager | null
  protected authManager: AuthenticationManager | null

  constructor(options: TestRailClientOptions) {
    this.baseUrl = options.baseUrl
    this.username = options.username
    this.password = options.password
    this.configurationManager = null
    this.authManager = null

    this.prepareConfigurationManager()
    this.prepareAuthManager()
  }

  private prepareConfigurationManager() {
    this.configurationManager = new ConfigurationManager({
      name: 'testrail',
      type: 'api',
      base_path: 'index.php?',
      auth: {
        type: 'basic',
        location: 'header',
        key: 'Authorization',
        payload: 'Basic {encodedCredentials}',
      },
      source: {
      },
      target: {
        projects: {
          endpoints: {
            create: {
              path: 'api/v2/add_project',
            },
            delete: {
              path: 'api/v2/delete_project/{project_id}',
            },
          },
        },
      },
    }, {
      allowMutation: true,
      baseUrl: this.baseUrl,
      credentials: {
        encodedCredentials: Buffer.from(`${this.username}:${this.password}`).toString('base64'),
      },
    })

    this.configurationManager.applySubstitutions()
  }

  private prepareAuthManager() {
    if (!this.configurationManager) {
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
