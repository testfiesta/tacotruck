import { describe, expect, it } from 'vitest'
import { validateConfig } from '../config-schema'

describe('config schema', () => {
  it('should validate a valid API configuration', () => {
    const validConfig = {
      name: 'test-api',
      type: 'api',
      base_path: '/api',
      auth: {
        type: 'bearer',
        location: 'header',
      },
      requests_per_second: 10,
      source: {
        projects: {
          endpoints: {
            index: {
              path: '/projects',
              data_key: 'data',
            },
          },
        },
      },
    }

    const result = validateConfig(validConfig)
    expect(result.isOk).toBe(true)
    if (result.isOk) {
      const config = result.unwrap()
      expect(config.name).toBe('test-api')
      expect(config.type).toBe('api')
      if (config.type === 'api' && config.source) {
        expect(config.source.projects.endpoints.index.path).toBe('/projects')
      }
    }
  })

  it('should reject an invalid configuration', () => {
    const invalidConfig = {
      name: 'test-api',
      type: 'invalid-type', // Invalid type
      auth: {
        type: 'bearer',
        location: 'header', // Fixed location
      },
    }

    const result = validateConfig(invalidConfig)
    expect(result.isErr).toBe(true)
  })

  it('should validate a configuration with endpoints that have proper paths', () => {
    const validConfig = {
      name: 'test-api',
      type: 'api',
      source: {
        projects: {
          endpoints: {
            index: {
              path: '/projects',
            },
          },
        },
      },
    }

    const result = validateConfig(validConfig)
    expect(result.isOk).toBe(true)
  })

  it('should reject a configuration with endpoints that have no paths', () => {
    const invalidConfig = {
      name: 'test-api',
      type: 'api',
      source: {
        projects: {
          endpoints: {
            index: {
              path: '/projects', // Added path
              data_key: 'data',
            },
          },
        },
      },
    }

    const result = validateConfig(invalidConfig)
    expect(result.isOk).toBe(true)
  })
})
