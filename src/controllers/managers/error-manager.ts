export enum ETLErrorType {
  CONFIGURATION = 'CONFIGURATION',
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  TRANSFORMATION = 'TRANSFORMATION',
  DATA = 'DATA',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

export interface ETLErrorContext {
  endpoint?: string
  operation?: string
  entityType?: string
  requestId?: string
  timestamp?: Date
  retryCount?: number
  originalError?: Error
  requestData?: any
  responseData?: any
  statusCode?: number
  headers?: Record<string, string>
  [key: string]: any
}

export class ETLError extends Error {
  public readonly type: ETLErrorType
  public readonly context: ETLErrorContext
  public readonly isRetryable: boolean
  public readonly timestamp: Date

  constructor(
    message: string,
    type: ETLErrorType = ETLErrorType.UNKNOWN,
    context: ETLErrorContext = {},
    isRetryable: boolean = false,
  ) {
    super(message)
    this.name = 'ETLError'
    this.type = type
    this.context = {
      timestamp: new Date(),
      ...context,
    }
    this.isRetryable = isRetryable
    this.timestamp = new Date()

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ETLError)
    }
  }

  /**
   * Get a formatted error message with context
   */
  getFormattedMessage(): string {
    const parts = [this.message]

    if (this.context.endpoint) {
      parts.push(`Endpoint: ${this.context.endpoint}`)
    }

    if (this.context.operation) {
      parts.push(`Operation: ${this.context.operation}`)
    }

    if (this.context.entityType) {
      parts.push(`Entity: ${this.context.entityType}`)
    }

    if (this.context.statusCode) {
      parts.push(`Status: ${this.context.statusCode}`)
    }

    return parts.join(' | ')
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      context: this.context,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    }
  }
}

export class ConfigurationError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}) {
    super(message, ETLErrorType.CONFIGURATION, context, false)
    this.name = 'ConfigurationError'
  }
}

export class AuthenticationError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}) {
    super(message, ETLErrorType.AUTHENTICATION, context, false)
    this.name = 'AuthenticationError'
  }
}

export class NetworkError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}, isRetryable: boolean = true) {
    super(message, ETLErrorType.NETWORK, context, isRetryable)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}) {
    super(message, ETLErrorType.VALIDATION, context, false)
    this.name = 'ValidationError'
  }
}

export class TransformationError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}) {
    super(message, ETLErrorType.TRANSFORMATION, context, false)
    this.name = 'TransformationError'
  }
}

export class DataError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}, isRetryable: boolean = false) {
    super(message, ETLErrorType.DATA, context, isRetryable)
    this.name = 'DataError'
  }
}

export class TimeoutError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}) {
    super(message, ETLErrorType.TIMEOUT, context, true)
    this.name = 'TimeoutError'
  }
}

export class RateLimitError extends ETLError {
  constructor(message: string, context: ETLErrorContext = {}) {
    super(message, ETLErrorType.RATE_LIMIT, context, true)
    this.name = 'RateLimitError'
  }
}

export interface ErrorSummary {
  totalErrors: number
  errorsByType: Record<ETLErrorType, number>
  retryableErrors: number
  nonRetryableErrors: number
  errors: ETLError[]
}

export class ErrorManager {
  private errors: ETLError[] = []
  private maxErrors: number
  private onErrorCallback?: (error: ETLError) => void

  constructor(maxErrors: number = 100, onErrorCallback?: (error: ETLError) => void) {
    this.maxErrors = maxErrors
    this.onErrorCallback = onErrorCallback
  }

  /**
   * Add an error to the collection
   */
  addError(error: ETLError): void {
    this.errors.push(error)

    if (this.onErrorCallback) {
      this.onErrorCallback(error)
    }

    if (this.errors.length > this.maxErrors) {
      this.errors.shift() // Remove oldest error
    }
  }

  /**
   * Create and add a new ETL error
   */
  createError(
    message: string,
    type: ETLErrorType = ETLErrorType.UNKNOWN,
    context: ETLErrorContext = {},
    isRetryable: boolean = false,
  ): ETLError {
    const error = new ETLError(message, type, context, isRetryable)
    this.addError(error)
    return error
  }

  /**
   * Create and add a configuration error
   */
  configurationError(message: string, context: ETLErrorContext = {}): ConfigurationError {
    const error = new ConfigurationError(message, context)
    this.addError(error)
    return error
  }

  /**
   * Create and add an authentication error
   */
  authenticationError(message: string, context: ETLErrorContext = {}): AuthenticationError {
    const error = new AuthenticationError(message, context)
    this.addError(error)
    return error
  }

  /**
   * Create and add a network error
   */
  networkError(message: string, context: ETLErrorContext = {}, isRetryable: boolean = true): NetworkError {
    const error = new NetworkError(message, context, isRetryable)
    this.addError(error)
    return error
  }

  /**
   * Create and add a validation error
   */
  validationError(message: string, context: ETLErrorContext = {}): ValidationError {
    const error = new ValidationError(message, context)
    this.addError(error)
    return error
  }

  /**
   * Create and add a transformation error
   */
  transformationError(message: string, context: ETLErrorContext = {}): TransformationError {
    const error = new TransformationError(message, context)
    this.addError(error)
    return error
  }

  /**
   * Create and add a data error
   */
  dataError(message: string, context: ETLErrorContext = {}, isRetryable: boolean = false): DataError {
    const error = new DataError(message, context, isRetryable)
    this.addError(error)
    return error
  }

  /**
   * Create and add a timeout error
   */
  timeoutError(message: string, context: ETLErrorContext = {}): TimeoutError {
    const error = new TimeoutError(message, context)
    this.addError(error)
    return error
  }

  /**
   * Create and add a rate limit error
   */
  rateLimitError(message: string, context: ETLErrorContext = {}): RateLimitError {
    const error = new RateLimitError(message, context)
    this.addError(error)
    return error
  }

  /**
   * Get all errors
   */
  getErrors(): ETLError[] {
    return [...this.errors]
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ETLErrorType): ETLError[] {
    return this.errors.filter(error => error.type === type)
  }

  /**
   * Get retryable errors
   */
  getRetryableErrors(): ETLError[] {
    return this.errors.filter(error => error.isRetryable)
  }

  /**
   * Get non-retryable errors
   */
  getNonRetryableErrors(): ETLError[] {
    return this.errors.filter(error => !error.isRetryable)
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0
  }

  /**
   * Check if there are any critical (non-retryable) errors
   */
  hasCriticalErrors(): boolean {
    return this.errors.some(error => !error.isRetryable)
  }

  /**
   * Get error summary
   */
  getSummary(): ErrorSummary {
    const errorsByType: Record<ETLErrorType, number> = {
      [ETLErrorType.CONFIGURATION]: 0,
      [ETLErrorType.AUTHENTICATION]: 0,
      [ETLErrorType.NETWORK]: 0,
      [ETLErrorType.VALIDATION]: 0,
      [ETLErrorType.TRANSFORMATION]: 0,
      [ETLErrorType.DATA]: 0,
      [ETLErrorType.TIMEOUT]: 0,
      [ETLErrorType.RATE_LIMIT]: 0,
      [ETLErrorType.UNKNOWN]: 0,
    }

    let retryableErrors = 0
    let nonRetryableErrors = 0

    for (const error of this.errors) {
      errorsByType[error.type]++
      if (error.isRetryable) {
        retryableErrors++
      }
      else {
        nonRetryableErrors++
      }
    }

    return {
      totalErrors: this.errors.length,
      errorsByType,
      retryableErrors,
      nonRetryableErrors,
      errors: [...this.errors],
    }
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = []
  }

  /**
   * Convert error from standard Error to ETLError
   */
  static fromError(
    error: Error,
    type: ETLErrorType = ETLErrorType.UNKNOWN,
    context: ETLErrorContext = {},
  ): ETLError {
    const etlError = new ETLError(error.message, type, {
      ...context,
      originalError: error,
    })

    if (error.stack) {
      etlError.stack = error.stack
    }

    return etlError
  }

  /**
   * Handle and convert various error types
   */
  static handleError(
    error: unknown,
    defaultType: ETLErrorType = ETLErrorType.UNKNOWN,
    context: ETLErrorContext = {},
  ): ETLError {
    if (error instanceof ETLError) {
      return error
    }

    if (error instanceof Error) {
      return ErrorManager.fromError(error, defaultType, context)
    }

    // Handle string errors
    if (typeof error === 'string') {
      return new ETLError(error, defaultType, context)
    }

    // Handle unknown error types
    return new ETLError(
      `Unknown error: ${String(error)}`,
      defaultType,
      { ...context, originalError: error instanceof Error ? error : new Error(String(error)) },
    )
  }
}
