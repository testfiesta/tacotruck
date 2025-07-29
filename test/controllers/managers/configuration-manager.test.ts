import type { ConfigType } from '../../../src/utils/config-schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConfigurationManager } from '../../../src/controllers/managers/configuration-manager'

describe('configurationManager', () => {
  const mockConfig: ConfigType = {
    name: 'test-config',
    type: 'api',
    base_path: '/{environment}',
    auth: {
      type: 'bearer',
      location: 'header',
      key: 'Authorization',
      payload: 'Bearer {token}',
    },
    source: {
      projects: {
        endpoints: {
          index: { path: '/projects' },
          get: { path: '/projects/{id}' },
        },
      },
    },
    target: {
      projects: {
        endpoints: {
          create: {
            bulk_path: '/bulk/projects/{workspace}',
            single_path: '/projects',
            data_key: 'entries',
            include_source: true,
          },
        },
      },
    },
    multi_target: {
      path: '/bulk/multi/{workspace}',
      data_key: 'data',
      include_source: true,
    },
  }

  const mockCredentials = {
    environment: 'staging',
    token: 'test-token-123',
    workspace: 'test-workspace',
  }

  let configManager: ConfigurationManager

  beforeEach(() => {
    configManager = new ConfigurationManager(mockConfig, {
      credentials: mockCredentials,
      allowMutation: false,
    })
  })

  describe('constructor', () => {
    it('should create a new instance with default options', () => {
      const manager = new ConfigurationManager(mockConfig)
      expect(manager).toBeInstanceOf(ConfigurationManager)
    })

    it('should clone the original config to prevent mutation', () => {
      const originalConfig = { ...mockConfig }
      const manager = new ConfigurationManager(mockConfig, { credentials: mockCredentials })

      // Apply substitutions which would modify the config
      manager.applySubstitutions()

      expect(mockConfig).toEqual(originalConfig)
    })

    it('should allow mutation when explicitly enabled', () => {
      const manager = new ConfigurationManager(mockConfig, {
        allowMutation: true,
        credentials: mockCredentials,
      })

      expect(manager).toBeInstanceOf(ConfigurationManager)
    })
  })

  describe('getConfig', () => {
    it('should return a copy of the processed configuration by default', () => {
      const config1 = configManager.getConfig()
      const config2 = configManager.getConfig()

      expect(config1).toEqual(config2)
      expect(config1).not.toBe(config2)
    })

    it('should return the same reference when allowMutation is true', () => {
      const manager = new ConfigurationManager(mockConfig, {
        allowMutation: true,
        credentials: mockCredentials,
      })

      const config1 = manager.getConfig()
      const config2 = manager.getConfig()

      expect(config1).toBe(config2)
    })
  })

  describe('getOriginalConfig', () => {
    it('should return a copy of the original unmodified configuration', () => {
      configManager.applySubstitutions()

      const originalConfig = configManager.getOriginalConfig()
      expect(originalConfig.base_path).toBe('/{environment}')
      expect(originalConfig.auth?.payload).toBe('Bearer {token}')
    })
  })

  describe('updateCredentials', () => {
    it('should update credentials and reprocess configuration', () => {
      const newCredentials = { environment: 'production', token: 'prod-token' }
      configManager.updateCredentials(newCredentials)

      configManager.applySubstitutions()
      const config = configManager.getConfig()

      expect(config.base_path).toBe('/production')
      expect(config.auth?.payload).toBe('Bearer prod-token')
    })

    it('should merge new credentials with existing ones', () => {
      configManager.updateCredentials({ newField: 'new-value' })

      // Original credentials should still be available
      configManager.applySubstitutions()
      const config = configManager.getConfig()

      expect(config.base_path).toBe('/staging')
    })
  })

  describe('applySubstitutions', () => {
    beforeEach(() => {
      configManager.applySubstitutions()
    })

    it('should substitute placeholders in base_path', () => {
      const config = configManager.getConfig()
      expect(config.base_path).toBe('/staging')
    })

    it('should substitute placeholders in auth payload', () => {
      const config = configManager.getConfig()
      expect(config.auth?.payload).toBe('Bearer test-token-123')
    })

    it('should substitute placeholders in source endpoints', () => {
      const config = configManager.getConfig()
      // Source endpoints don't have placeholders in this test, but the method should run without error
      expect(config.source?.projects?.endpoints?.index?.path).toBe('/projects')
    })

    it('should substitute placeholders in target endpoints', () => {
      const config = configManager.getConfig()
      expect(config.target?.projects?.endpoints?.create?.bulk_path).toBe('/bulk/projects/test-workspace')
    })

    it('should substitute placeholders in multi_target path', () => {
      const config = configManager.getConfig()
      expect((config as any).multi_target?.path).toBe('/bulk/multi/test-workspace')
    })
  })

  describe('getBaseUrl', () => {
    it('should return baseUrl when base_path is not available', () => {
      const manager = new ConfigurationManager(mockConfig, {
        baseUrl: 'https://custom.api.com',
      })
      expect(manager.getBaseUrl()).toBe('https://custom.api.com')
    })

    it('should return empty string when neither base_path nor baseUrl is available', () => {
      const configWithoutBase = { ...mockConfig }
      delete (configWithoutBase as any).base_path

      const manager = new ConfigurationManager(configWithoutBase)
      expect(manager.getBaseUrl()).toBe('')
    })
  })

  describe('getIntegrationName', () => {
    it('should return the config name for api type', () => {
      expect(configManager.getIntegrationName()).toBe('test-config')
    })

    it('should return the config name for json type', () => {
      const jsonConfig = { ...mockConfig, type: 'json' as const }
      const manager = new ConfigurationManager(jsonConfig)
      expect(manager.getIntegrationName()).toBe('test-config')
    })

    it('should return the config name for junit type', () => {
      const junitConfig = { ...mockConfig, type: 'junit' as const }
      const manager = new ConfigurationManager(junitConfig)
      expect(manager.getIntegrationName()).toBe('test-config')
    })

    it('should return default for other types', () => {
      const otherConfig = { ...mockConfig, type: 'file' as any }
      const manager = new ConfigurationManager(otherConfig)
      expect(manager.getIntegrationName()).toBe('default')
    })
  })

  describe('getEndpointSet', () => {
    it('should return source endpoint keys for api type', () => {
      const endpoints = configManager.getEndpointSet()
      expect(endpoints).toEqual(['projects'])
    })

    it('should return empty array when no source is configured', () => {
      const configWithoutSource = { ...mockConfig }
      delete configWithoutSource.source

      const manager = new ConfigurationManager(configWithoutSource)
      expect(manager.getEndpointSet()).toEqual([])
    })

    it('should return empty array for non-api types', () => {
      const fileConfig = { ...mockConfig, type: 'file' as any }
      const manager = new ConfigurationManager(fileConfig)
      expect(manager.getEndpointSet()).toEqual([])
    })
  })

  describe('validateConfiguration', () => {
    it('should validate a correct configuration without throwing', () => {
      expect(() => configManager.validateConfiguration()).not.toThrow()
    })

    it('should throw error for missing configuration', () => {
      const manager = new ConfigurationManager(null as any)
      expect(() => manager.validateConfiguration()).toThrow('Configuration is required')
    })

    it('should throw error for missing type', () => {
      const invalidConfig = { ...mockConfig }
      delete (invalidConfig as any).type

      const manager = new ConfigurationManager(invalidConfig)
      expect(() => manager.validateConfiguration()).toThrow('Configuration type is required')
    })

    it('should validate API configuration with base_path', () => {
      expect(() => configManager.validateConfiguration()).not.toThrow()
    })

    it('should validate API configuration with baseUrl', () => {
      const configWithBaseUrl = { ...mockConfig, baseUrl: 'https://api.example.com' }
      delete (configWithBaseUrl as any).base_path

      const manager = new ConfigurationManager(configWithBaseUrl)
      expect(() => manager.validateConfiguration()).not.toThrow()
    })

    it('should throw error for API config without base_path or baseUrl', () => {
      const invalidConfig = { ...mockConfig }
      delete (invalidConfig as any).base_path

      const manager = new ConfigurationManager(invalidConfig)
      expect(() => manager.validateConfiguration()).toThrow('API configuration requires either base_path or baseUrl')
    })

    it('should throw error for source endpoint missing path', () => {
      const invalidConfig = {
        ...mockConfig,
        source: {
          projects: {
            endpoints: {
              index: {}, // Missing path
              get: { path: '/projects/{id}' },
            },
          },
        },
      }

      const manager = new ConfigurationManager(invalidConfig)
      expect(() => manager.validateConfiguration()).toThrow('Source endpoint projects.index missing path')
    })

    it('should throw error for target endpoint missing path configuration', () => {
      const invalidConfig = {
        ...mockConfig,
        target: {
          projects: {
            endpoints: {
              create: {}, // Missing all path configurations
            },
          },
        },
      }

      const manager = new ConfigurationManager(invalidConfig)
      expect(() => manager.validateConfiguration()).toThrow('Target endpoint projects.create missing path configuration')
    })
  })

  describe('placeholder substitution', () => {
    it('should handle multiple placeholders in a single string', () => {
      const configWithMultiplePlaceholders = {
        ...mockConfig,
        base_path: '/{environment}/api/v1/{token}',
      }

      const manager = new ConfigurationManager(
        configWithMultiplePlaceholders,
        { credentials: mockCredentials },
      )

      manager.applySubstitutions()
      const config = manager.getConfig()

      expect(config.base_path).toBe('/staging/api/v1/test-token-123')
    })

    it('should handle missing credentials gracefully', () => {
      const configWithMissingCredential = {
        ...mockConfig,
        base_path: '/api/{missing_credential}',
      }

      const manager = new ConfigurationManager(
        configWithMissingCredential,
        { credentials: {} },
      )

      manager.applySubstitutions()
      const config = manager.getConfig()

      expect(config.base_path).toBe('/api/{missing_credential}')
    })

    it('should handle empty string input', () => {
      const configWithEmptyPath = {
        ...mockConfig,
        base_path: '',
      }

      const manager = new ConfigurationManager(
        configWithEmptyPath,
        { credentials: mockCredentials },
      )

      manager.applySubstitutions()
      const config = manager.getConfig()

      expect(config.base_path).toBe('')
    })

    it('should handle string without placeholders', () => {
      const configWithoutPlaceholders = {
        ...mockConfig,
        base_path: '/api/example',
      }

      const manager = new ConfigurationManager(
        configWithoutPlaceholders,
        { credentials: mockCredentials },
      )

      manager.applySubstitutions()
      const config = manager.getConfig()

      expect(config.base_path).toBe('/api/example')
    })
  })

  describe('error handling', () => {
    it('should handle malformed configuration gracefully', () => {
      const malformedConfig = {
        type: 'api',
        source: null,
        target: undefined,
      } as any

      const manager = new ConfigurationManager(malformedConfig)
      expect(manager.getEndpointSet()).toEqual([])
      expect(manager.getIntegrationName()).toBe('default')
    })

    it('should handle circular references in credentials', () => {
      const circularCreds: any = { key: 'value' }
      circularCreds.self = circularCreds

      const manager = new ConfigurationManager(mockConfig, { credentials: circularCreds })
      expect(() => manager.applySubstitutions()).not.toThrow()
    })
  })

  describe('complex substitution scenarios', () => {
    it('should handle nested object substitutions', () => {
      const complexConfig = {
        ...mockConfig,
        custom: {
          nested: {
            url: 'https://{environment}.{subdomain}.com/{workspace}',
          },
        },
      } as any

      const complexCreds = {
        ...mockCredentials,
        subdomain: 'api',
      }

      const manager = new ConfigurationManager(complexConfig, { credentials: complexCreds })
      manager.applySubstitutions()

      const config = manager.getConfig()
      expect((config as any).custom.nested.url).toBe('https://staging.api.com/test-workspace')
    })

    it('should preserve non-string values during substitution', () => {
      const configWithNumbers = {
        ...mockConfig,
        timeout: 30000,
        retries: 3,
        enabled: true,
      } as any

      const manager = new ConfigurationManager(configWithNumbers, { credentials: mockCredentials })
      manager.applySubstitutions()

      const config = manager.getConfig()
      expect((config as any).timeout).toBe(30000)
      expect((config as any).retries).toBe(3)
      expect((config as any).enabled).toBe(true)
    })
  })
})
