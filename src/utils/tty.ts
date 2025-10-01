import { hasTTY } from 'std-env'

/**
 * Checks if stdout is an interactive terminal (TTY)
 * When stdout is not a TTY (e.g., piped to a file or another process),
 * animations and progress bars should be disabled for better output parsing
 */
export function isInteractiveTTY(): boolean {
  return hasTTY
}

/**
 * Determines if animations should be shown based on TTY status
 * @returns true if animations should be displayed, false otherwise
 */
export function shouldShowAnimations(): boolean {
  return isInteractiveTTY()
}

/**
 * Determines if progress bars should be shown based on TTY status
 * @returns true if progress bars should be displayed, false otherwise
 */
export function shouldShowProgressBars(): boolean {
  return isInteractiveTTY()
}

/**
 * Determines if colored output should be used based on TTY status
 * @returns true if colors should be used, false otherwise
 */
export function shouldUseColors(): boolean {
  return isInteractiveTTY()
}
