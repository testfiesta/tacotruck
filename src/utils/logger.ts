import type { LoggingOptions } from '../controllers/managers/logging-manager'
import { LoggingManager, LogLevel } from '../controllers/managers/logging-manager'

let logger: LoggingManager | null = null

/**
 * Initialize the global logger with options
 * @param options Logging options
 * @returns The logger instance
 */
export function initializeLogger(options: { verbose?: boolean } = {}): LoggingManager {
  const loggingOptions: LoggingOptions = {
    level: options.verbose ? LogLevel.DEBUG : LogLevel.INFO,
    enableConsoleOutput: true,
    enableFileOutput: false,
    enableStructuredLogging: options.verbose,
  }

  if (!logger) {
    logger = new LoggingManager(loggingOptions)
  }
  else {
    logger.updateOptions(loggingOptions)
  }

  return logger
}

/**
 * Get the global logger instance
 * Creates a default instance if one doesn't exist
 * @returns The logger instance
 */
export function getLogger(): LoggingManager {
  if (!logger) {
    return initializeLogger()
  }
  return logger
}

/**
 * Set verbose logging mode
 * @param verbose Whether to enable verbose logging
 */
export function setVerbose(verbose: boolean): void {
  const currentLogger = getLogger()
  currentLogger.updateOptions({
    level: verbose ? LogLevel.DEBUG : LogLevel.INFO,
    enableStructuredLogging: verbose,
  })
}
