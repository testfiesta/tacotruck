import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthenticationError,
  ConfigurationError,
  DataError,
  ErrorManager,
  ETLError,
  ETLErrorType,
  NetworkError,
  RateLimitError,
  TimeoutError,
  TransformationError,
  ValidationError,
} from '../../../src/controllers/managers/error-manager'

describe('errorManager', () => {
  let errorManager: ErrorManager

  beforeEach(() => {
    errorManager = new ErrorManager()
  })

  describe('constructor', () => {
    it('should create a new instance with default options', () => {
      expect(errorManager).toBeInstanceOf(ErrorManager)
    })

    it('should create instance with custom max errors', () => {
      const manager = new ErrorManager(50)
      expect(manager).toBeInstanceOf(ErrorManager)
    })

    it('should call callback when provided', () => {
      const callback = vi.fn()
      const manager = new ErrorManager(100, callback)

      const error = new ETLError('test error')
      manager.addError(error)

      expect(callback).toHaveBeenCalledWith(error)
    })
  })

  describe('addError', () => {
    it('should add error to collection', () => {
      const error = new ETLError('test error')
      errorManager.addError(error)

      const errors = errorManager.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe(error)
    })

    it('should maintain max error limit', () => {
      const manager = new ErrorManager(2)

      manager.addError(new ETLError('error 1'))
      manager.addError(new ETLError('error 2'))
      manager.addError(new ETLError('error 3'))

      const errors = manager.getErrors()
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe('error 2') // First error removed
      expect(errors[1].message).toBe('error 3')
    })

    it('should trigger callback for each error', () => {
      const callback = vi.fn()
      const manager = new ErrorManager(100, callback)

      const error1 = new ETLError('error 1')
      const error2 = new ETLError('error 2')

      manager.addError(error1)
      manager.addError(error2)

      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenCalledWith(error1)
      expect(callback).toHaveBeenCalledWith(error2)
    })
  })

  describe('createError', () => {
    it('should create and add ETL error', () => {
      const error = errorManager.createError('test message', ETLErrorType.NETWORK)

      expect(error).toBeInstanceOf(ETLError)
      expect(error.message).toBe('test message')
      expect(error.type).toBe(ETLErrorType.NETWORK)
      expect(errorManager.getErrors()).toContain(error)
    })

    it('should use default error type', () => {
      const error = errorManager.createError('test message')

      expect(error.type).toBe(ETLErrorType.UNKNOWN)
    })

    it('should include context and retryable flag', () => {
      const context = { endpoint: 'test-endpoint' }
      const error = errorManager.createError('test message', ETLErrorType.NETWORK, context, true)

      expect(error.context).toMatchObject(context)
      expect(error.isRetryable).toBe(true)
    })
  })

  describe('specific error creators', () => {
    it('should create configuration error', () => {
      const error = errorManager.configurationError('config error')

      expect(error).toBeInstanceOf(ConfigurationError)
      expect(error.type).toBe(ETLErrorType.CONFIGURATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create authentication error', () => {
      const error = errorManager.authenticationError('auth error')

      expect(error).toBeInstanceOf(AuthenticationError)
      expect(error.type).toBe(ETLErrorType.AUTHENTICATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create network error', () => {
      const error = errorManager.networkError('network error')

      expect(error).toBeInstanceOf(NetworkError)
      expect(error.type).toBe(ETLErrorType.NETWORK)
      expect(error.isRetryable).toBe(true) // Default for network errors
    })

    it('should create network error with custom retryable flag', () => {
      const error = errorManager.networkError('network error', {}, false)

      expect(error.isRetryable).toBe(false)
    })

    it('should create validation error', () => {
      const error = errorManager.validationError('validation error')

      expect(error).toBeInstanceOf(ValidationError)
      expect(error.type).toBe(ETLErrorType.VALIDATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create transformation error', () => {
      const error = errorManager.transformationError('transformation error')

      expect(error).toBeInstanceOf(TransformationError)
      expect(error.type).toBe(ETLErrorType.TRANSFORMATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create data error', () => {
      const error = errorManager.dataError('data error')

      expect(error).toBeInstanceOf(DataError)
      expect(error.type).toBe(ETLErrorType.DATA)
      expect(error.isRetryable).toBe(false) // Default for data errors
    })

    it('should create data error with custom retryable flag', () => {
      const error = errorManager.dataError('data error', {}, true)

      expect(error.isRetryable).toBe(true)
    })

    it('should create timeout error', () => {
      const error = errorManager.timeoutError('timeout error')

      expect(error).toBeInstanceOf(TimeoutError)
      expect(error.type).toBe(ETLErrorType.TIMEOUT)
      expect(error.isRetryable).toBe(true)
    })

    it('should create rate limit error', () => {
      const error = errorManager.rateLimitError('rate limit error')

      expect(error).toBeInstanceOf(RateLimitError)
      expect(error.type).toBe(ETLErrorType.RATE_LIMIT)
      expect(error.isRetryable).toBe(true)
    })
  })

  describe('getErrorsByType', () => {
    beforeEach(() => {
      errorManager.configurationError('config error')
      errorManager.networkError('network error 1')
      errorManager.networkError('network error 2')
      errorManager.validationError('validation error')
    })

    it('should return errors of specific type', () => {
      const networkErrors = errorManager.getErrorsByType(ETLErrorType.NETWORK)

      expect(networkErrors).toHaveLength(2)
      expect(networkErrors.every(e => e.type === ETLErrorType.NETWORK)).toBe(true)
    })

    it('should return empty array for non-existent type', () => {
      const timeoutErrors = errorManager.getErrorsByType(ETLErrorType.TIMEOUT)

      expect(timeoutErrors).toHaveLength(0)
    })
  })

  describe('getRetryableErrors and getNonRetryableErrors', () => {
    beforeEach(() => {
      errorManager.configurationError('config error') // non-retryable
      errorManager.networkError('network error') // retryable
      errorManager.timeoutError('timeout error') // retryable
      errorManager.validationError('validation error') // non-retryable
    })

    it('should return only retryable errors', () => {
      const retryableErrors = errorManager.getRetryableErrors()

      expect(retryableErrors).toHaveLength(2)
      expect(retryableErrors.every(e => e.isRetryable)).toBe(true)
    })

    it('should return only non-retryable errors', () => {
      const nonRetryableErrors = errorManager.getNonRetryableErrors()

      expect(nonRetryableErrors).toHaveLength(2)
      expect(nonRetryableErrors.every(e => !e.isRetryable)).toBe(true)
    })
  })

  describe('hasErrors and hasCriticalErrors', () => {
    it('should return false when no errors exist', () => {
      expect(errorManager.hasErrors()).toBe(false)
      expect(errorManager.hasCriticalErrors()).toBe(false)
    })

    it('should return true when errors exist', () => {
      errorManager.networkError('network error')

      expect(errorManager.hasErrors()).toBe(true)
      expect(errorManager.hasCriticalErrors()).toBe(false) // Network error is retryable
    })

    it('should return true for critical errors', () => {
      errorManager.configurationError('config error')

      expect(errorManager.hasErrors()).toBe(true)
      expect(errorManager.hasCriticalErrors()).toBe(true)
    })
  })

  describe('getSummary', () => {
    beforeEach(() => {
      errorManager.configurationError('config error')
      errorManager.networkError('network error 1')
      errorManager.networkError('network error 2')
      errorManager.validationError('validation error')
      errorManager.timeoutError('timeout error')
    })

    it('should provide comprehensive error summary', () => {
      const summary = errorManager.getSummary()

      expect(summary.totalErrors).toBe(5)
      expect(summary.retryableErrors).toBe(3) // 2 network + 1 timeout
      expect(summary.nonRetryableErrors).toBe(2) // 1 config + 1 validation

      expect(summary.errorsByType[ETLErrorType.CONFIGURATION]).toBe(1)
      expect(summary.errorsByType[ETLErrorType.NETWORK]).toBe(2)
      expect(summary.errorsByType[ETLErrorType.VALIDATION]).toBe(1)
      expect(summary.errorsByType[ETLErrorType.TIMEOUT]).toBe(1)
      expect(summary.errorsByType[ETLErrorType.AUTHENTICATION]).toBe(0)
    })

    it('should include all errors in summary', () => {
      const summary = errorManager.getSummary()

      expect(summary.errors).toHaveLength(5)
      expect(summary.errors).toEqual(errorManager.getErrors())
    })
  })

  describe('clear', () => {
    it('should remove all errors', () => {
      errorManager.configurationError('config error')
      errorManager.networkError('network error')

      expect(errorManager.hasErrors()).toBe(true)

      errorManager.clear()

      expect(errorManager.hasErrors()).toBe(false)
      expect(errorManager.getErrors()).toHaveLength(0)
    })
  })

  describe('static methods', () => {
    describe('fromError', () => {
      it('should convert standard Error to ETLError', () => {
        const originalError = new Error('original message')
        const etlError = ErrorManager.fromError(originalError, ETLErrorType.NETWORK)

        expect(etlError).toBeInstanceOf(ETLError)
        expect(etlError.message).toBe('original message')
        expect(etlError.type).toBe(ETLErrorType.NETWORK)
        expect(etlError.context.originalError).toBe(originalError)
      })

      it('should preserve stack trace', () => {
        const originalError = new Error('original message')
        const originalStack = originalError.stack

        const etlError = ErrorManager.fromError(originalError)

        expect(etlError.stack).toBe(originalStack)
      })

      it('should include context', () => {
        const originalError = new Error('original message')
        const context = { endpoint: 'test-endpoint' }

        const etlError = ErrorManager.fromError(originalError, ETLErrorType.NETWORK, context)

        expect(etlError.context).toMatchObject(context)
        expect(etlError.context.originalError).toBe(originalError)
      })
    })

    describe('handleError', () => {
      it('should return ETLError as-is', () => {
        const originalError = new ETLError('test message', ETLErrorType.NETWORK)
        const result = ErrorManager.handleError(originalError)

        expect(result).toBe(originalError)
      })

      it('should convert standard Error to ETLError', () => {
        const originalError = new Error('test message')
        const result = ErrorManager.handleError(originalError, ETLErrorType.VALIDATION)

        expect(result).toBeInstanceOf(ETLError)
        expect(result.type).toBe(ETLErrorType.VALIDATION)
        expect(result.context.originalError).toBe(originalError)
      })

      it('should convert string to ETLError', () => {
        const result = ErrorManager.handleError('string error', ETLErrorType.DATA)

        expect(result).toBeInstanceOf(ETLError)
        expect(result.message).toBe('string error')
        expect(result.type).toBe(ETLErrorType.DATA)
      })

      it('should handle unknown error types', () => {
        const unknownError = { custom: 'error object' }
        const result = ErrorManager.handleError(unknownError)

        expect(result).toBeInstanceOf(ETLError)
        expect(result.message).toContain('Unknown error')
        expect(result.type).toBe(ETLErrorType.UNKNOWN)
        expect(result.context.originalError).toBe(unknownError)
      })

      it('should include context', () => {
        const context = { endpoint: 'test' }
        const result = ErrorManager.handleError('test error', ETLErrorType.NETWORK, context)

        expect(result.context).toMatchObject(context)
      })
    })
  })
})

describe('eTLError classes', () => {
  describe('eTLError', () => {
    it('should create error with all properties', () => {
      const context = { endpoint: 'test-endpoint' }
      const error = new ETLError('test message', ETLErrorType.NETWORK, context, true)

      expect(error.message).toBe('test message')
      expect(error.type).toBe(ETLErrorType.NETWORK)
      expect(error.context).toMatchObject(context)
      expect(error.isRetryable).toBe(true)
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    it('should use default values', () => {
      const error = new ETLError('test message')

      expect(error.type).toBe(ETLErrorType.UNKNOWN)
      expect(error.isRetryable).toBe(false)
      expect(error.context.timestamp).toBeInstanceOf(Date)
    })

    describe('getFormattedMessage', () => {
      it('should format message with context', () => {
        const error = new ETLError('test message', ETLErrorType.NETWORK, {
          endpoint: 'test-endpoint',
          operation: 'fetch',
          entityType: 'projects',
          statusCode: 404,
        })

        const formatted = error.getFormattedMessage()

        expect(formatted).toContain('test message')
        expect(formatted).toContain('Endpoint: test-endpoint')
        expect(formatted).toContain('Operation: fetch')
        expect(formatted).toContain('Entity: projects')
        expect(formatted).toContain('Status: 404')
      })

      it('should format message without optional context', () => {
        const error = new ETLError('test message')

        const formatted = error.getFormattedMessage()

        expect(formatted).toBe('test message')
      })
    })

    describe('toJSON', () => {
      it('should serialize error to JSON', () => {
        const error = new ETLError('test message', ETLErrorType.NETWORK, { test: 'context' }, true)

        const json = error.toJSON()

        expect(json.name).toBe('ETLError')
        expect(json.message).toBe('test message')
        expect(json.type).toBe(ETLErrorType.NETWORK)
        expect(json.context).toMatchObject({ test: 'context' })
        expect(json.isRetryable).toBe(true)
        expect(json.timestamp).toBeDefined()
        expect(json.stack).toBeDefined()
      })
    })
  })

  describe('specific error classes', () => {
    it('should create ConfigurationError with correct defaults', () => {
      const error = new ConfigurationError('config error')

      expect(error.name).toBe('ConfigurationError')
      expect(error.type).toBe(ETLErrorType.CONFIGURATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create AuthenticationError with correct defaults', () => {
      const error = new AuthenticationError('auth error')

      expect(error.name).toBe('AuthenticationError')
      expect(error.type).toBe(ETLErrorType.AUTHENTICATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create NetworkError with correct defaults', () => {
      const error = new NetworkError('network error')

      expect(error.name).toBe('NetworkError')
      expect(error.type).toBe(ETLErrorType.NETWORK)
      expect(error.isRetryable).toBe(true)
    })

    it('should create NetworkError with custom retryable flag', () => {
      const error = new NetworkError('network error', {}, false)

      expect(error.isRetryable).toBe(false)
    })

    it('should create ValidationError with correct defaults', () => {
      const error = new ValidationError('validation error')

      expect(error.name).toBe('ValidationError')
      expect(error.type).toBe(ETLErrorType.VALIDATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create TransformationError with correct defaults', () => {
      const error = new TransformationError('transformation error')

      expect(error.name).toBe('TransformationError')
      expect(error.type).toBe(ETLErrorType.TRANSFORMATION)
      expect(error.isRetryable).toBe(false)
    })

    it('should create DataError with correct defaults', () => {
      const error = new DataError('data error')

      expect(error.name).toBe('DataError')
      expect(error.type).toBe(ETLErrorType.DATA)
      expect(error.isRetryable).toBe(false)
    })

    it('should create DataError with custom retryable flag', () => {
      const error = new DataError('data error', {}, true)

      expect(error.isRetryable).toBe(true)
    })

    it('should create TimeoutError with correct defaults', () => {
      const error = new TimeoutError('timeout error')

      expect(error.name).toBe('TimeoutError')
      expect(error.type).toBe(ETLErrorType.TIMEOUT)
      expect(error.isRetryable).toBe(true)
    })

    it('should create RateLimitError with correct defaults', () => {
      const error = new RateLimitError('rate limit error')

      expect(error.name).toBe('RateLimitError')
      expect(error.type).toBe(ETLErrorType.RATE_LIMIT)
      expect(error.isRetryable).toBe(true)
    })
  })

  describe('error inheritance', () => {
    it('should maintain Error prototype chain', () => {
      const error = new ETLError('test message')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ETLError)
    })

    it('should maintain specific error prototype chains', () => {
      const configError = new ConfigurationError('config error')

      expect(configError).toBeInstanceOf(Error)
      expect(configError).toBeInstanceOf(ETLError)
      expect(configError).toBeInstanceOf(ConfigurationError)
    })

    it('should have proper stack traces', () => {
      const error = new ETLError('test message')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ETLError')
    })
  })
})
