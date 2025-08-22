import { setupServer } from 'msw/node'
import { testfiestaHandlers } from './testfiesta-handlers'

export const server = setupServer(...testfiestaHandlers)

export function resetHandlers() {
  server.resetHandlers(...testfiestaHandlers)
}

export function addHandlers(...handlers: Parameters<typeof server.use>) {
  server.use(...handlers)
}
