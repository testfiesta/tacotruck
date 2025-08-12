import type { z } from 'zod'
import type { AuthOptions } from '../utils/network'
import { substituteUrlStrict } from '../utils/url-substitutor'

export interface BaseClientOptions {
  domain: string
  baseUrl: string
}

export abstract class BaseClient {
  protected authOptions!: AuthOptions
  protected domain: string
  protected baseUrl: string
  constructor(options: BaseClientOptions) {
    this.domain = options.domain
    this.baseUrl = options.baseUrl
  }

  protected validateData<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid ${context} input: ${result.error.message}`)
    }
    return result.data
  }

  /**
   * Get a route for a specific resource and action
   * @param resource The resource type (e.g., 'projects', 'runs')
   * @param action The action to perform (e.g., 'create', 'list', 'get')
   * @param params URL parameters
   * @param queryParams Query parameters
   * @returns The complete URL
   */
  public getRoute(resource: string, action: string, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    const routeMap = this.getRouteMap()
    const resourceRoutes = routeMap[resource as keyof typeof routeMap]

    if (!resourceRoutes) {
      throw new Error(`Unknown resource: ${resource}`)
    }

    const route = resourceRoutes[action.toUpperCase() as keyof typeof resourceRoutes]
    if (!route) {
      throw new Error(`Unknown action: ${action} for resource: ${resource}`)
    }
    const fullRoute = `${this.domain}${this.baseUrl}${route}`

    return substituteUrlStrict(fullRoute, { ...params, ...queryParams })
  }

  /**
   * Get the route map for this client
   * This method should be implemented by subclasses
   * @returns The route map object
   */
  protected abstract getRouteMap(): Record<string, Record<string, string>>
}
