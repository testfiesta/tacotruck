import type { ConfigType } from '../../../src/utils/config-schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthenticationManager } from '../../../src/controllers/managers/authentication-manager'

describe('authenticationManager', () => {
  const mockCredentials = {
    token: 'test-token-123',
    username: 'testuser',
    password: 'testpass',
    apiKey: 'test-api-key',
    api_key: 'alternative-api-key',
    base64Credentials: 'dGVzdHVzZXI6dGVzdHBhc3M=',
  }

  const mockBearerConfig: ConfigType = {
    name: 'test-bearer',
    type: 'api',
    base_path: 'https://api.example.com',
    auth: {
      type: 'bearer',
      location: 'header',
      key: 'Authorization',
      payload: 'Bearer {token}',
    },
  }

  const mockBasicConfig: ConfigType = {
    name: 'test-basic',
    type: 'api',
    base_path: 'https://api.example.com',
    auth: {
      type: 'basic',
      location: 'header',
      key: 'Authorization',
      payload: 'Basic {base64Credentials}',
    },
  }

  const mockApiKeyConfig: ConfigType = {
    name: 'test-apikey',
    type: 'api',
    base_path: 'https://api.example.com',
    auth: {
      type: 'apikey',
      location: 'header',
      key: 'X-API-Key',
    },
  }

  let authManager: AuthenticationManager

  beforeEach(() => {
    authManager = new AuthenticationManager({
      credentials: mockCredentials,
    })
  })

  describe('constructor', () => {
    it('should create a new instance with default options', () => {
      const manager = new AuthenticationManager()
      expect(manager).toBeInstanceOf(AuthenticationManager)
    })

    it('should create a new instance with credentials', () => {
      const manager = new AuthenticationManager({ credentials: mockCredentials })
      expect(manager.getCredentials()).toEqual(mockCredentials)
    })
  })

  describe('initializeFromConfig', () => {
    it('should initialize bearer authentication from config', () => {
      authManager.initializeFromConfig(mockBearerConfig)

      const authOptions = authManager.getAuthOptions()
      expect(authOptions).toEqual({
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer {token}',
      })
    })

    it('should initialize basic authentication from config', () => {
      authManager.initializeFromConfig(mockBasicConfig)

      const authOptions = authManager.getAuthOptions()
      expect(authOptions).toEqual({
        type: 'basic',
        location: 'header',
        key: 'Authorization',
        payload: 'Basic {base64Credentials}',
      })
    })

    it('should initialize API key authentication from config', () => {
      authManager.initializeFromConfig(mockApiKeyConfig)

      const authOptions = authManager.getAuthOptions()
      expect(authOptions).toEqual({
        type: 'apikey',
        location: 'header',
        key: 'X-API-Key',
      })
    })

    it('should handle config without auth', () => {
      const configWithoutAuth = { ...mockBearerConfig }
      delete configWithoutAuth.auth

      authManager.initializeFromConfig(configWithoutAuth)

      expect(authManager.getAuthOptions()).toBeNull()
      expect(authManager.hasAuthentication()).toBe(false)
    })

    it('should handle minimal auth config', () => {
      const minimalConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: 'bearer',
          location: 'header',
        },
      }

      authManager.initializeFromConfig(minimalConfig)

      const authOptions = authManager.getAuthOptions()
      expect(authOptions?.type).toBe('bearer')
      expect(authOptions?.location).toBe('header')
      expect(authOptions?.key).toBeUndefined()
      expect(authOptions?.payload).toBeUndefined()
    })
  })

  describe('updateCredentials', () => {
    it('should merge new credentials with existing ones', () => {
      const newCredentials = { token: 'new-token', newField: 'new-value' }

      authManager.updateCredentials(newCredentials)

      const credentials = authManager.getCredentials()
      expect(credentials.token).toBe('new-token')
      expect(credentials.username).toBe('testuser') // Original credential preserved
      expect(credentials.newField).toBe('new-value')
    })

    it('should handle empty credentials update', () => {
      authManager.updateCredentials({})

      const credentials = authManager.getCredentials()
      expect(credentials).toEqual(mockCredentials)
    })
  })

  describe('setCredentials', () => {
    it('should replace all existing credentials', () => {
      const newCredentials = { token: 'new-token', apiKey: 'new-api-key' }

      authManager.setCredentials(newCredentials)

      const credentials = authManager.getCredentials()
      expect(credentials).toEqual(newCredentials)
      expect(credentials.username).toBeUndefined() // Original credential removed
    })
  })

  describe('getCredential', () => {
    it('should return specific credential value', () => {
      expect(authManager.getCredential('token')).toBe('test-token-123')
      expect(authManager.getCredential('username')).toBe('testuser')
    })

    it('should return undefined for non-existent credential', () => {
      expect(authManager.getCredential('nonexistent')).toBeUndefined()
    })
  })

  describe('hasCredential', () => {
    it('should return true for existing credentials', () => {
      expect(authManager.hasCredential('token')).toBe(true)
      expect(authManager.hasCredential('username')).toBe(true)
    })

    it('should return false for non-existent credentials', () => {
      expect(authManager.hasCredential('nonexistent')).toBe(false)
    })

    it('should return false for undefined credentials', () => {
      authManager.setCredentials({ token: 'test', undefinedField: undefined })
      expect(authManager.hasCredential('undefinedField')).toBe(false)
    })
  })

  describe('validateRequiredCredentials', () => {
    it('should not throw for available credentials', () => {
      expect(() => {
        authManager.validateRequiredCredentials(['token', 'username'])
      }).not.toThrow()
    })

    it('should throw for missing credentials', () => {
      expect(() => {
        authManager.validateRequiredCredentials(['token', 'nonexistent'])
      }).toThrow('Missing required credentials: nonexistent')
    })

    it('should throw for multiple missing credentials', () => {
      expect(() => {
        authManager.validateRequiredCredentials(['missing1', 'missing2'])
      }).toThrow('Missing required credentials: missing1, missing2')
    })

    it('should handle empty required credentials array', () => {
      expect(() => {
        authManager.validateRequiredCredentials([])
      }).not.toThrow()
    })
  })

  describe('getProcessedAuthOptions', () => {
    beforeEach(() => {
      authManager.initializeFromConfig(mockBearerConfig)
    })

    it('should process bearer token substitution', () => {
      const processed = authManager.getProcessedAuthOptions()

      expect(processed?.payload).toBe('Bearer test-token-123')
    })

    it('should return null when no auth is configured', () => {
      const manager = new AuthenticationManager()
      expect(manager.getProcessedAuthOptions()).toBeNull()
    })

    it('should handle missing token credential', () => {
      const managerWithoutToken = new AuthenticationManager({
        credentials: { username: 'test' },
      })
      managerWithoutToken.initializeFromConfig(mockBearerConfig)

      const processed = managerWithoutToken.getProcessedAuthOptions()
      expect(processed?.payload).toBe('Bearer {token}') // Placeholder not replaced
    })

    it('should replace multiple credential placeholders', () => {
      const complexConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: 'custom',
          location: 'header',
          key: 'Authorization',
          payload: 'Custom {username}:{token}',
        },
      }

      authManager.initializeFromConfig(complexConfig)
      const processed = authManager.getProcessedAuthOptions()

      expect(processed?.payload).toBe('Custom testuser:test-token-123')
    })

    it('should handle payload without placeholders', () => {
      const staticConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: 'static',
          location: 'header',
          key: 'Authorization',
          payload: 'Static-Token',
        },
      }

      authManager.initializeFromConfig(staticConfig)
      const processed = authManager.getProcessedAuthOptions()

      expect(processed?.payload).toBe('Static-Token')
    })
  })

  describe('validateAuthConfiguration', () => {
    it('should validate valid bearer authentication', () => {
      authManager.initializeFromConfig(mockBearerConfig)
      expect(() => authManager.validateAuthConfiguration()).not.toThrow()
    })

    it('should validate valid basic authentication', () => {
      authManager.initializeFromConfig(mockBasicConfig)
      expect(() => authManager.validateAuthConfiguration()).not.toThrow()
    })

    it('should validate valid API key authentication', () => {
      authManager.initializeFromConfig(mockApiKeyConfig)
      expect(() => authManager.validateAuthConfiguration()).not.toThrow()
    })

    it('should not throw when no auth is configured', () => {
      const manager = new AuthenticationManager()
      expect(() => manager.validateAuthConfiguration()).not.toThrow()
    })

    it('should throw for missing auth type', () => {
      const invalidConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: '',
          location: 'header',
        },
      }

      authManager.initializeFromConfig(invalidConfig)
      expect(() => authManager.validateAuthConfiguration()).toThrow('Authentication type is required')
    })

    it('should throw for missing auth location', () => {
      const invalidConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: 'bearer',
          location: '' as any,
        },
      }

      authManager.initializeFromConfig(invalidConfig)
      expect(() => authManager.validateAuthConfiguration()).toThrow('Authentication location is required')
    })

    it('should throw for invalid auth location', () => {
      const invalidConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: 'bearer',
          location: 'invalid' as any,
        },
      }

      authManager.initializeFromConfig(invalidConfig)
      expect(() => authManager.validateAuthConfiguration()).toThrow('Authentication location must be header, query, or body')
    })

    it('should throw for bearer auth without payload', () => {
      const invalidConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: 'bearer',
          location: 'header',
        },
      }

      authManager.initializeFromConfig(invalidConfig)
      expect(() => authManager.validateAuthConfiguration()).toThrow('Bearer authentication requires a payload template')
    })

    it('should throw for bearer auth without token credential', () => {
      const managerWithoutToken = new AuthenticationManager({
        credentials: { username: 'test' },
      })
      managerWithoutToken.initializeFromConfig(mockBearerConfig)

      expect(() => managerWithoutToken.validateAuthConfiguration()).toThrow('Bearer authentication requires a token credential')
    })

    it('should throw for basic auth without username/password', () => {
      const managerWithoutBasicCreds = new AuthenticationManager({
        credentials: { token: 'test' },
      })
      managerWithoutBasicCreds.initializeFromConfig(mockBasicConfig)

      expect(() => managerWithoutBasicCreds.validateAuthConfiguration()).toThrow('Basic authentication requires base64Credentials')
    })

    it('should throw for API key auth without key field', () => {
      const invalidConfig: ConfigType = {
        name: 'test',
        type: 'api',
        base_path: 'https://api.example.com',
        auth: {
          type: 'apikey',
          location: 'header',
        },
      }

      authManager.initializeFromConfig(invalidConfig)
      expect(() => authManager.validateAuthConfiguration()).toThrow('API key authentication requires a key field')
    })

    it('should throw for API key auth without api key credential', () => {
      const managerWithoutApiKey = new AuthenticationManager({
        credentials: { token: 'test' },
      })
      managerWithoutApiKey.initializeFromConfig(mockApiKeyConfig)

      expect(() => managerWithoutApiKey.validateAuthConfiguration()).toThrow('API key authentication requires an apiKey or api_key credential')
    })

    it('should accept alternative api_key credential name', () => {
      const managerWithApiKey = new AuthenticationManager({
        credentials: { api_key: 'test-key' },
      })
      managerWithApiKey.initializeFromConfig(mockApiKeyConfig)

      expect(() => managerWithApiKey.validateAuthConfiguration()).not.toThrow()
    })
  })

  describe('clear', () => {
    it('should clear all authentication data', () => {
      authManager.initializeFromConfig(mockBearerConfig)

      expect(authManager.hasAuthentication()).toBe(true)
      expect(Object.keys(authManager.getCredentials()).length).toBeGreaterThan(0)

      authManager.clear()

      expect(authManager.hasAuthentication()).toBe(false)
      expect(authManager.getCredentials()).toEqual({})
      expect(authManager.getAuthOptions()).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle null credentials', () => {
      const manager = new AuthenticationManager({ credentials: null as any })
      expect(manager.getCredentials()).toEqual({})
    })

    it('should handle undefined credentials', () => {
      const manager = new AuthenticationManager({ credentials: undefined })
      expect(manager.getCredentials()).toEqual({})
    })

    it('should handle credentials with null values', () => {
      const credentialsWithNull = { token: null, username: 'test' }
      authManager.setCredentials(credentialsWithNull as any)

      expect(authManager.hasCredential('token')).toBe(false)
      expect(authManager.hasCredential('username')).toBe(true)
    })

    it('should handle very long credential values', () => {
      const longToken = 'a'.repeat(10000)
      authManager.updateCredentials({ token: longToken })

      expect(authManager.getCredential('token')).toBe(longToken)
    })

    it('should handle special characters in credentials', () => {
      const specialCredentials = {
        token: 'test-token!@#$%^&*()',
        password: 'pass with spaces and symbols: <>?"|{}',
      }

      authManager.setCredentials(specialCredentials)
      expect(authManager.getCredentials()).toEqual(specialCredentials)
    })
  })

  describe('concurrent operations', () => {
    it('should handle rapid credential updates', () => {
      for (let i = 0; i < 100; i++) {
        authManager.updateCredentials({ counter: i })
      }

      expect(authManager.getCredential('counter')).toBe(99)
    })

    it('should maintain consistency during multiple operations', () => {
      authManager.initializeFromConfig(mockBearerConfig)
      authManager.updateCredentials({ token: 'updated-token' })

      const processed = authManager.getProcessedAuthOptions()
      expect(processed?.payload).toBe('Bearer updated-token')
    })
  })
})
