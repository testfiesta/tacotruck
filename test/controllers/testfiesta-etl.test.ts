/* eslint-disable no-new */
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
  describe('config Substitution', () => {
    it('should substitute {token} in auth.payload', () => {
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

      ;(config as any).credentials = {
        token: 'test-token-123',
      }

      new TestFiestaETL(config)

      expect(config.auth?.payload).toBe('Bearer test-token-123')
    })

    it('should substitute {handle} in base_path', () => {
      const config: ConfigType = {
        name: 'test-config',
        type: 'api',
        base_path: 'v1/{handle}/',
      }

      ;(config as any).credentials = {
        handle: 'test-org',
      }

      new TestFiestaETL(config)

      expect(config.base_path).toBe('v1/test-org/')
    })

    it('should substitute {handle} and {projectKey} in multi_target path', () => {
      const config: ConfigType = {
        name: 'test-config',
        type: 'api',
        multi_target: {
          path: '{handle}/projects/{projectKey}/data',
          data_key: 'entries',
          include_source: true,
        },
      }

      ;(config as any).credentials = {
        handle: 'test-org',
        projectKey: 'TEST-123',
      }

      new TestFiestaETL(config)

      expect((config as any).multi_target.path).toBe('test-org/projects/TEST-123/data')
    })

    it('should substitute placeholders in endpoint paths', () => {
      const config: ConfigType = {
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

      ;(config as any).credentials = {
        handle: 'test-org',
        projectKey: 'TEST-123',
      }
      new TestFiestaETL(config)

      expect((config.target?.projects as any).endpoints.create.bulk_path).toBe('/v1/test-org/projects/TEST-123/data')
    })

    it('should handle multiple substitutions in the same string', () => {
      const config: ConfigType = {
        name: 'test-config',
        type: 'api',
        base_path: 'v1/{handle}/{region}/',
      }

      ;(config as any).credentials = {
        handle: 'test-org',
        region: 'us-west',
        token: 'test-token-123',
      }

      new TestFiestaETL(config)

      expect(config.base_path).toBe('v1/test-org/us-west/')
    })

    it('should not modify placeholders when credentials are missing', () => {
      const config: ConfigType = {
        name: 'test-config',
        type: 'api',
        base_path: 'v1/{handle}/{region}/',
      }

      ;(config as any).credentials = {
        handle: 'test-org',
      }

      new TestFiestaETL(config)

      expect(config.base_path).toBe('v1/test-org/{region}/')
    })

    it('should handle empty credentials gracefully', () => {
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

      new TestFiestaETL(config)

      expect(config.base_path).toBe('v1/{handle}/')
      expect(config.auth?.payload).toBe('Bearer {token}')
    })
  })
})
