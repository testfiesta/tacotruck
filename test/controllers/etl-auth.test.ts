import type { ETLOptions } from '../../src/controllers/etl-base'
import type { ConfigType } from '../../src/utils/config-schema'
import { describe, expect, it, vi } from 'vitest'
import { ETL } from '../../src/controllers/etl-base'
import { apiClient } from '../../src/services/api-client'

vi.mock('../../src/services/api-client', () => ({
  apiClient: {
    processPostRequest: vi.fn().mockResolvedValue({ status: 200, data: { success: true } }),
    processGetRequest: vi.fn().mockResolvedValue(null),
    buildUrl: vi.fn().mockReturnValue('https://api.example.com/test'),
  },
}))

const mockedApiClient = apiClient as unknown as {
  processGetRequest: ReturnType<typeof vi.fn>
  processPostRequest: ReturnType<typeof vi.fn>
  buildUrl: ReturnType<typeof vi.fn>
}

describe('eTL Authentication Handling', () => {
  const testConfig: ConfigType = {
    name: 'test-etl',
    type: 'api',
    auth: {
      type: 'bearer',
      location: 'header',
      key: 'Authorization',
      payload: 'Bearer {token}',
    },
  }

  const testCredentials = {
    token: 'test-token-123',
  }

  it('should process authentication options during initialization', () => {
    const etlOptions: ETLOptions = {
      credentials: testCredentials,
    }

    const etl = new ETL(testConfig, etlOptions)

    const authOptions = (etl as any).authOptions
    expect(authOptions).toBeDefined()
    expect(authOptions.type).toBe('bearer')
    expect(authOptions.location).toBe('header')
    expect(authOptions.key).toBe('Authorization')
    expect(authOptions.payload).toBe('Bearer test-token-123')
  })

  it('should use authOptions when making API requests', async () => {
    const etlOptions: ETLOptions = {
      credentials: testCredentials,
    }

    const etl = new ETL(testConfig, etlOptions)

    await (etl as any).processSimpleGetRequest('/test', 'test-endpoint', {})
    expect(mockedApiClient.processGetRequest).toHaveBeenCalled()

    const callArgs = mockedApiClient.processGetRequest.mock.calls[0]
    const passedAuthOptions = callArgs[0]

    expect(passedAuthOptions).toBeDefined()
    expect(passedAuthOptions.payload).toBe('Bearer test-token-123')
  })

  it('should not mutate the original config when processing auth', () => {
    const configCopy = JSON.parse(JSON.stringify(testConfig))

    const etlOptions: ETLOptions = {
      credentials: testCredentials,
    }

    const etl = new ETL(configCopy, etlOptions)

    expect(configCopy.auth.payload).toBe('Bearer {token}')

    const authOptions = (etl as any).authOptions
    expect(authOptions.payload).toBe('Bearer test-token-123')
  })
})
