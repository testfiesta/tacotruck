/**
 * Utility function for building API routes with resources and actions
 */

/**
 * Get a route for a given resource and action with provided parameters
 *
 * @param routeMap Object mapping resources to route configurations
 * @param resource The resource to access (e.g., 'projects', 'runs')
 * @param action The action to perform (e.g., 'list', 'create', 'delete')
 * @param buildRouteFn Function to build the final route with parameters
 * @param params Path parameters for the route
 * @param queryParams Query parameters for the route
 * @returns The built route URL
 */
export function getRoute<T extends Record<string, Record<string, string>>>(
  routeMap: T,
  resource: string,
  action: string,
  buildRouteFn: (route: string, params: Record<string, string>, queryParams: Record<string, string>) => string,
  params: Record<string, string> = {},
  queryParams: Record<string, string> = {},
): string {
  const resourceRoutes = routeMap[resource as keyof typeof routeMap]
  if (!resourceRoutes) {
    throw new Error(`Unknown resource: ${resource}`)
  }

  const route = resourceRoutes[action.toUpperCase() as keyof typeof resourceRoutes]
  if (!route) {
    throw new Error(`Unknown action: ${action} for resource: ${resource}`)
  }

  return buildRouteFn(route, params, queryParams)
}
