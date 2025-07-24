import type { ConfigType } from '../../src/utils/config-schema'
import { describe, expect, it, vi } from 'vitest'
import { TestFiestaETL } from '../../src/controllers/testfiesta-etl'

vi.mock('../../src/controllers/etl', () => ({
  executeETL: vi.fn().mockResolvedValue({}),
  extractData: vi.fn().mockResolvedValue({}),
  transformData: vi.fn().mockReturnValue({}),
  loadData: vi.fn().mockResolvedValue(undefined),
}))

describe('testFiestaETL', () => {
  describe('authentication handling', () => {
    it('should prepare authOptions with bearer token from credentials', () => {
      const config: ConfigType = {
        name: 'test-config',
        type: 'api',
        auth: {
          type: 'bearer',
          location: 'header',
          key: 'Authorization',
          payload: 'Bearer {token}',
        },
      }

      const credentials = {
        token: 'test-token-123',
      }

      const etl = new TestFiestaETL(config, { credentials })

      expect(config.auth?.payload).toBe('Bearer {token}')

      expect((etl as any).authOptions).toEqual({
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer test-token-123',
      })
    })

    it('should handle missing auth configuration', () => {
      const config: ConfigType = {
        name: 'test-config',
        type: 'api',
      }

      const etl = new TestFiestaETL(config)

      expect((etl as any).authOptions).toBeNull()
    })
  })

  describe('config substitution', () => {
    it('should substitute {handle} in base_path when accessing ETL instance', () => {
      const originalConfig = {
        name: 'test-config',
        type: 'api',
        base_path: 'v1/{handle}/',
      }

      const config: ConfigType = JSON.parse(JSON.stringify(originalConfig))

      const credentials = {
        handle: 'test-org',
      }

      const etl = new TestFiestaETL(config, { credentials })

      expect(config.base_path).toBe('v1/test-org/')

      expect((etl as any).config.base_path).toBe('v1/test-org/')
    })

    it('should substitute {handle} and {projectKey} in multi_target path', () => {
      const originalConfig = {
        name: 'test-config',
        type: 'api',
        multi_target: {
          path: '{handle}/projects/{projectKey}/data',
          data_key: 'entries',
          include_source: true,
        },
      }

      const config: ConfigType = JSON.parse(JSON.stringify(originalConfig))

      const credentials = {
        handle: 'test-org',
        projectKey: 'TEST-123',
      }

      const etl = new TestFiestaETL(config, { credentials })

      expect((config as any).multi_target.path).toBe('test-org/projects/TEST-123/data')

      expect((etl as any).config.multi_target.path).toBe('test-org/projects/TEST-123/data')
    })

    it('should substitute placeholders in endpoint paths', () => {
      const originalConfig = {
        name: 'test-config',
        type: 'api',
        target: {
          projects: {
            endpoints: {
              create: {
                bulk_path: '/v1/{handle}/projects/{projectKey}/data',
                data_key: 'entries',
                include_source: true,
              },
            },
          },
        },
      }

      const config: ConfigType = JSON.parse(JSON.stringify(originalConfig))

      const credentials = {
        handle: 'test-org',
        projectKey: 'TEST-123',
      }

      const etl = new TestFiestaETL(config, { credentials })

      expect((config.target?.projects as any).endpoints.create.bulk_path).toBe('/v1/test-org/projects/TEST-123/data')

      expect((etl as any).config.target.projects.endpoints.create.bulk_path).toBe('/v1/test-org/projects/TEST-123/data')
    })

    it('should handle multiple substitutions in the same string', () => {
      const originalConfig = {
        name: 'test-config',
        type: 'api',
        base_path: 'v1/{handle}/{region}/',
      }

      const config: ConfigType = JSON.parse(JSON.stringify(originalConfig))

      const credentials = {
        handle: 'test-org',
        region: 'us-west',
        token: 'test-token-123',
      }

      const etl = new TestFiestaETL(config, { credentials })

      expect(config.base_path).toBe('v1/test-org/us-west/')

      expect((etl as any).config.base_path).toBe('v1/test-org/us-west/')
    })

    it('should not modify placeholders when credentials are missing', () => {
      const originalConfig = {
        name: 'test-config',
        type: 'api',
        base_path: 'v1/{handle}/{region}/',
      }

      const config: ConfigType = JSON.parse(JSON.stringify(originalConfig))

      const credentials = {
        handle: 'test-org',
      }

      const etl = new TestFiestaETL(config, { credentials })

      expect(config.base_path).toBe('v1/test-org/{region}/')

      expect((etl as any).config.base_path).toBe('v1/test-org/{region}/')
    })
  })

  describe('getConfigWithAuth', () => {
    it('should return a copy of config with authOptions', () => {
      const config: ConfigType = {
        name: 'test-config',
        type: 'api',
        base_path: 'v1/{handle}/',
        auth: {
          type: 'bearer',
          location: 'header',
          key: 'Authorization',
          payload: 'Bearer {token}',
        },
      }

      const credentials = {
        handle: 'test-org',
        token: 'test-token-123',
      }

      const etl = new TestFiestaETL(config, { credentials })

      const configWithAuth = (etl as any).getConfigWithAuth()

      expect(configWithAuth).not.toBe(config)

      expect(configWithAuth.base_path).toBe('v1/test-org/')

      expect(configWithAuth.auth).toEqual({
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer test-token-123',
      })
    })
  })
})
