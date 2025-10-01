import * as p from '@clack/prompts'
import { shouldShowAnimations } from './tty'

/**
 * TTY-aware spinner that only shows animations in interactive terminals
 */
export interface TTYSpinner {
  start: (message?: string) => void
  stop: (message?: string) => void
  message: (message: string) => void
}

/**
 * Creates a TTY-aware spinner that respects terminal capabilities
 * @returns A spinner instance that only animates in interactive terminals
 */
export function createSpinner(): TTYSpinner {
  const shouldAnimate = shouldShowAnimations()
  let actualSpinner: ReturnType<typeof p.spinner> | undefined

  if (shouldAnimate) {
    actualSpinner = p.spinner()
  }

  return {
    start(message?: string): void {
      if (actualSpinner && message) {
        actualSpinner.start(message)
      }
      else if (!shouldAnimate && message) {
        // In non-TTY environments, just log the start message
        console.warn(`⏳ ${message}`)
      }
    },

    stop(message?: string): void {
      if (actualSpinner) {
        actualSpinner.stop(message)
      }
      else if (!shouldAnimate && message) {
        // In non-TTY environments, just log the completion message
        console.warn(`✓ ${message}`)
      }
    },

    message(message: string): void {
      if (actualSpinner) {
        actualSpinner.message(message)
      }
      else if (!shouldAnimate) {
        // In non-TTY environments, just log the progress message
        console.warn(`⏳ ${message}`)
      }
    },
  }
}

/**
 * Legacy compatibility function - creates a spinner using the new TTY-aware implementation
 * @deprecated Use createSpinner() instead for better TTY detection
 */
export function spinner(): TTYSpinner {
  return createSpinner()
}
