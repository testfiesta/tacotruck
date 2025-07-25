export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: Record<string, any>
  phase?: string
  operation?: string
  endpoint?: string
  duration?: number
  recordCount?: number
  error?: any
  requestId?: string
  userId?: string
  sessionId?: string
}

export interface LoggingOptions {
  level?: LogLevel
  enableConsoleOutput?: boolean
  enableFileOutput?: boolean
  enableStructuredLogging?: boolean
  logFilePath?: string
  maxLogFileSize?: number
  maxLogFiles?: number
  includeStackTrace?: boolean
  redactSensitiveData?: boolean
  sensitiveFields?: string[]
  customFormatters?: Record<string, (entry: LogEntry) => string>
}

export interface LogFilter {
  level?: LogLevel
  phase?: string
  operation?: string
  endpoint?: string
  startTime?: Date
  endTime?: Date
  hasError?: boolean
  contains?: string
}

export interface LogSummary {
  totalEntries: number
  entriesByLevel: Record<LogLevel, number>
  entriesByPhase: Record<string, number>
  timeRange: {
    start: Date
    end: Date
  }
  errorCount: number
  warningCount: number
  topOperations: Array<{ operation: string, count: number }>
  topEndpoints: Array<{ endpoint: string, count: number }>
  averageDuration: number
  totalRecordsProcessed: number
}

export class LoggingManager {
  private logs: LogEntry[] = []
  private options: Required<LoggingOptions>
  private logHandlers: Array<(entry: LogEntry) => void> = []
  private sessionId: string
  private requestCounter = 0

  constructor(options: LoggingOptions = {}) {
    this.options = {
      level: LogLevel.INFO,
      enableConsoleOutput: true,
      enableFileOutput: false,
      enableStructuredLogging: true,
      logFilePath: './etl.log',
      maxLogFileSize: 10 * 1024 * 1024, // 10MB
      maxLogFiles: 5,
      includeStackTrace: false,
      redactSensitiveData: true,
      sensitiveFields: ['password', 'token', 'apiKey', 'secret', 'key', 'auth'],
      customFormatters: {},
      ...options,
    }

    this.sessionId = this.generateSessionId()
    this.initializeDefaultHandlers()
  }

  /**
   * Log a debug message
   * @param message The log message
   * @param context Additional context information
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * Log an info message
   * @param message The log message
   * @param context Additional context information
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * Log a warning message
   * @param message The log message
   * @param context Additional context information
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context)
  }

  /**
   * Log an error message
   * @param message The log message
   * @param context Additional context information
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context)
  }

  /**
   * Log a critical message
   * @param message The log message
   * @param context Additional context information
   */
  critical(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, context)
  }

  /**
   * Log the start of an operation
   * @param operation The operation name
   * @param context Additional context
   * @returns Operation ID for tracking
   */
  startOperation(operation: string, context?: Record<string, any>): string {
    const operationId = this.generateRequestId()
    this.info(`Starting operation: ${operation}`, {
      ...context,
      operation,
      operationId,
      operationStart: true,
    })
    return operationId
  }

  /**
   * Log the end of an operation
   * @param operation The operation name
   * @param operationId The operation ID from startOperation
   * @param duration Duration in milliseconds
   * @param context Additional context
   */
  endOperation(
    operation: string,
    operationId: string,
    duration: number,
    context?: Record<string, any>,
  ): void {
    this.info(`Completed operation: ${operation}`, {
      ...context,
      operation,
      operationId,
      duration,
      operationEnd: true,
    })
  }

  /**
   * Log phase transitions (extract, transform, load)
   * @param phase The phase name
   * @param action 'start' or 'end'
   * @param context Additional context
   */
  logPhase(phase: string, action: 'start' | 'end', context?: Record<string, any>): void {
    const message = action === 'start'
      ? `Starting ${phase} phase`
      : `Completed ${phase} phase`

    this.info(message, {
      ...context,
      phase,
      phaseAction: action,
    })
  }

  /**
   * Log network requests
   * @param method HTTP method
   * @param url Request URL
   * @param statusCode Response status code
   * @param duration Request duration in milliseconds
   * @param context Additional context
   */
  logNetworkRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: Record<string, any>,
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.DEBUG
    const redactedUrl = this.redactSensitiveData(url)

    this.log(level, `${method} ${redactedUrl} - ${statusCode}`, {
      ...context,
      networkRequest: true,
      method,
      url: redactedUrl,
      statusCode,
      duration,
      success: statusCode < 400,
    })
  }

  /**
   * Log data processing metrics
   * @param phase The processing phase
   * @param recordCount Number of records processed
   * @param duration Processing duration
   * @param context Additional context
   */
  logDataProcessing(
    phase: string,
    recordCount: number,
    duration: number,
    context?: Record<string, any>,
  ): void {
    const recordsPerSecond = duration > 0 ? (recordCount / duration) * 1000 : 0

    this.info(`Processed ${recordCount} records in ${phase}`, {
      ...context,
      phase,
      recordCount,
      duration,
      recordsPerSecond,
      dataProcessing: true,
    })
  }

  /**
   * Log errors with stack traces and context
   * @param error The error object
   * @param context Additional context
   */
  logError(error: Error | any, context?: Record<string, any>): void {
    const errorContext = {
      ...context,
      errorName: error.name || 'Unknown',
      errorMessage: error.message || String(error),
      errorType: typeof error,
      ...(this.options.includeStackTrace && error.stack && { stack: error.stack }),
    }

    this.error(`Error occurred: ${error.message || String(error)}`, errorContext)
  }

  /**
   * Log performance metrics
   * @param metrics Performance metrics object
   */
  logPerformanceMetrics(metrics: Record<string, any>): void {
    this.info('Performance metrics', {
      ...metrics,
      performanceMetrics: true,
    })
  }

  /**
   * Log with custom level and context
   * @param level Log level
   * @param message Log message
   * @param context Additional context
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.options.level) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.options.redactSensitiveData
        ? this.redactSensitiveDataFromContext(context)
        : context,
      requestId: this.generateRequestId(),
      sessionId: this.sessionId,
    }

    // Extract common fields from context
    if (context) {
      entry.phase = context.phase
      entry.operation = context.operation
      entry.endpoint = context.endpoint
      entry.duration = context.duration
      entry.recordCount = context.recordCount
      entry.error = context.error
    }

    this.logs.push(entry)
    this.executeHandlers(entry)
    this.maintainLogSize()
  }

  /**
   * Add a custom log handler
   * @param handler Function to handle log entries
   */
  addHandler(handler: (entry: LogEntry) => void): void {
    this.logHandlers.push(handler)
  }

  /**
   * Remove a log handler
   * @param handler The handler to remove
   */
  removeHandler(handler: (entry: LogEntry) => void): void {
    const index = this.logHandlers.indexOf(handler)
    if (index > -1) {
      this.logHandlers.splice(index, 1)
    }
  }

  /**
   * Get filtered logs
   * @param filter Filter criteria
   * @returns Filtered log entries
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    if (!filter) {
      return [...this.logs]
    }

    return this.logs.filter((entry) => {
      if (filter.level !== undefined && entry.level < filter.level) {
        return false
      }

      if (filter.phase && entry.phase !== filter.phase) {
        return false
      }

      if (filter.operation && entry.operation !== filter.operation) {
        return false
      }

      if (filter.endpoint && entry.endpoint !== filter.endpoint) {
        return false
      }

      if (filter.startTime && entry.timestamp < filter.startTime) {
        return false
      }

      if (filter.endTime && entry.timestamp > filter.endTime) {
        return false
      }

      if (filter.hasError !== undefined) {
        const hasError = entry.level >= LogLevel.ERROR || !!entry.error
        if (hasError !== filter.hasError) {
          return false
        }
      }

      if (filter.contains) {
        const searchText = filter.contains.toLowerCase()
        const messageMatch = entry.message.toLowerCase().includes(searchText)
        const contextMatch = entry.context
          && JSON.stringify(entry.context).toLowerCase().includes(searchText)

        if (!messageMatch && !contextMatch) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Get log summary statistics
   * @param filter Optional filter to apply
   * @returns Log summary
   */
  getSummary(filter?: LogFilter): LogSummary {
    const filteredLogs = this.getLogs(filter)

    if (filteredLogs.length === 0) {
      return {
        totalEntries: 0,
        entriesByLevel: {
          [LogLevel.DEBUG]: 0,
          [LogLevel.INFO]: 0,
          [LogLevel.WARN]: 0,
          [LogLevel.ERROR]: 0,
          [LogLevel.CRITICAL]: 0,
        },
        entriesByPhase: {},
        timeRange: { start: new Date(), end: new Date() },
        errorCount: 0,
        warningCount: 0,
        topOperations: [],
        topEndpoints: [],
        averageDuration: 0,
        totalRecordsProcessed: 0,
      }
    }

    const entriesByLevel = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.CRITICAL]: 0,
    }

    const entriesByPhase: Record<string, number> = {}
    const operationCounts: Record<string, number> = {}
    const endpointCounts: Record<string, number> = {}
    const durations: number[] = []
    let totalRecordsProcessed = 0

    filteredLogs.forEach((entry) => {
      entriesByLevel[entry.level]++

      if (entry.phase) {
        entriesByPhase[entry.phase] = (entriesByPhase[entry.phase] || 0) + 1
      }

      if (entry.operation) {
        operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1
      }

      if (entry.endpoint) {
        endpointCounts[entry.endpoint] = (endpointCounts[entry.endpoint] || 0) + 1
      }

      if (entry.duration !== undefined) {
        durations.push(entry.duration)
      }

      if (entry.recordCount !== undefined) {
        totalRecordsProcessed += entry.recordCount
      }
    })

    const timestamps = filteredLogs.map(entry => entry.timestamp)
    const startTime = new Date(Math.min(...timestamps.map(t => t.getTime())))
    const endTime = new Date(Math.max(...timestamps.map(t => t.getTime())))

    const topOperations = Object.entries(operationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([operation, count]) => ({ operation, count }))

    const topEndpoints = Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }))

    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0

    return {
      totalEntries: filteredLogs.length,
      entriesByLevel,
      entriesByPhase,
      timeRange: { start: startTime, end: endTime },
      errorCount: entriesByLevel[LogLevel.ERROR] + entriesByLevel[LogLevel.CRITICAL],
      warningCount: entriesByLevel[LogLevel.WARN],
      topOperations,
      topEndpoints,
      averageDuration,
      totalRecordsProcessed,
    }
  }

  /**
   * Export logs to JSON format
   * @param filter Optional filter to apply
   * @returns JSON string of filtered logs
   */
  exportToJSON(filter?: LogFilter): string {
    const logs = this.getLogs(filter)
    return JSON.stringify(logs, null, 2)
  }

  /**
   * Export logs to CSV format
   * @param filter Optional filter to apply
   * @returns CSV string of filtered logs
   */
  exportToCSV(filter?: LogFilter): string {
    const logs = this.getLogs(filter)

    if (logs.length === 0) {
      return 'timestamp,level,message,phase,operation,endpoint,duration,recordCount\n'
    }

    const headers = ['timestamp', 'level', 'message', 'phase', 'operation', 'endpoint', 'duration', 'recordCount']
    const csvRows = [headers.join(',')]

    logs.forEach((entry) => {
      const row = [
        entry.timestamp.toISOString(),
        LogLevel[entry.level],
        `"${entry.message.replace(/"/g, '""')}"`,
        entry.phase || '',
        entry.operation || '',
        entry.endpoint || '',
        entry.duration?.toString() || '',
        entry.recordCount?.toString() || '',
      ]
      csvRows.push(row.join(','))
    })

    return csvRows.join('\n')
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = []
  }

  /**
   * Update logging options
   * @param options New options to merge
   */
  updateOptions(options: Partial<LoggingOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * Get current session ID
   * @returns Current session ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * Create a new session
   * @returns New session ID
   */
  newSession(): string {
    this.sessionId = this.generateSessionId()
    this.requestCounter = 0
    return this.sessionId
  }

  /**
   * Initialize default log handlers
   */
  private initializeDefaultHandlers(): void {
    if (this.options.enableConsoleOutput) {
      this.addHandler(this.consoleHandler.bind(this))
    }

    if (this.options.enableFileOutput) {
      this.addHandler(this.fileHandler.bind(this))
    }
  }

  /**
   * Console log handler
   * @param entry Log entry to output
   */
  private consoleHandler(entry: LogEntry): void {
    const levelName = LogLevel[entry.level]
    const timestamp = entry.timestamp.toISOString()

    let message = `[${timestamp}] ${levelName}: ${entry.message}`

    if (entry.context && Object.keys(entry.context).length > 0) {
      if (this.options.enableStructuredLogging) {
        message += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`
      }
      else {
        const contextStr = Object.entries(entry.context)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ')
        message += ` | ${contextStr}`
      }
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message)
        break
      case LogLevel.INFO:
        console.info(message)
        break
      case LogLevel.WARN:
        console.warn(message)
        break
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message)
        break
    }
  }

  /**
   * File log handler (placeholder - would need actual file system implementation)
   * @param entry Log entry to write
   */
  private fileHandler(entry: LogEntry): void {
    // This would implement actual file writing in a real scenario
    // For now, it's a placeholder that could be implemented based on environment
    const _logLine = this.formatForFile(entry)
    // writeToFile(this.options.logFilePath, logLine)
  }

  /**
   * Format log entry for file output
   * @param entry Log entry to format
   * @returns Formatted log line
   */
  private formatForFile(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString()
    const level = LogLevel[entry.level]
    const contextStr = entry.context ? JSON.stringify(entry.context) : ''

    return `${timestamp} | ${level} | ${entry.message} | ${contextStr}\n`
  }

  /**
   * Execute all registered handlers
   * @param entry Log entry to process
   */
  private executeHandlers(entry: LogEntry): void {
    this.logHandlers.forEach((handler) => {
      try {
        handler(entry)
      }
      catch (error) {
        // Prevent handler errors from affecting logging
        console.error('Log handler error:', error)
      }
    })
  }

  /**
   * Maintain log size to prevent memory issues
   */
  private maintainLogSize(): void {
    const maxEntries = 10000 // Keep last 10k entries
    if (this.logs.length > maxEntries) {
      this.logs = this.logs.slice(-maxEntries)
    }
  }

  /**
   * Redact sensitive data from context
   * @param context Context object to redact
   * @returns Redacted context
   */
  private redactSensitiveDataFromContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) {
      return context
    }

    const redacted = { ...context }

    for (const key of Object.keys(redacted)) {
      if (this.isSensitiveField(key)) {
        redacted[key] = '[REDACTED]'
      }
      else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = this.redactSensitiveDataFromContext(redacted[key])
      }
    }

    return redacted
  }

  /**
   * Redact sensitive data from strings (URLs, etc.)
   * @param data String to redact
   * @returns Redacted string
   */
  private redactSensitiveData(data: string): string {
    let result = data

    // Redact URL parameters that might contain sensitive data
    for (const field of this.options.sensitiveFields) {
      const regex = new RegExp(`([?&]${field}=)[^&]*`, 'gi')
      result = result.replace(regex, '$1[REDACTED]')
    }

    return result
  }

  /**
   * Check if a field name is sensitive
   * @param fieldName Field name to check
   * @returns True if field is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase()
    return this.options.sensitiveFields.some(sensitive =>
      lowerField.includes(sensitive.toLowerCase()),
    )
  }

  /**
   * Generate a unique session ID
   * @returns Unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate a unique request ID
   * @returns Unique request ID
   */
  private generateRequestId(): string {
    return `req_${this.sessionId}_${++this.requestCounter}`
  }
}
