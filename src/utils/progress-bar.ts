import chalk from 'chalk'
import * as cliProgress from 'cli-progress'

/**
 * Options for creating a progress bar
 */
export interface ProgressBarOptions {
  /** The total number of items to process */
  total: number
  /** Label to display next to the progress bar */
  label?: string
  /** Whether to show the progress bar */
  show?: boolean
  /** Whether to silence all console output */
  silent?: boolean
  /** Custom format function for the progress bar */
  formatFn?: (options: any, params: any, payload: any) => string
}

/**
 * Creates and returns a CLI progress bar
 * @param options Progress bar configuration options
 * @returns A progress bar instance or undefined if show is false
 */
export function createProgressBar(options: ProgressBarOptions): cliProgress.SingleBar | undefined {
  const { total, label = 'items', show = true, silent = false, formatFn } = options

  if (!show || silent) {
    return undefined
  }

  const progressBar = new cliProgress.SingleBar({
    format: formatFn || defaultProgressFormat,
    barCompleteChar: '█',
    barIncompleteChar: '░',
  })

  progressBar.start(total, 0, { label })
  return progressBar
}

/**
 * Default format function for progress bars
 */
export function defaultProgressFormat(options: any, params: any, _payload: any): string {
  const barCompleteChar = '█'
  const barIncompleteChar = '░'
  const barSize = 30

  const completeSize = Math.round(params.progress * barSize)
  const incompleteSize = barSize - completeSize

  const bar = barCompleteChar.repeat(completeSize) + barIncompleteChar.repeat(incompleteSize)

  const percentage = Math.floor(params.progress * 100)
  const value = params.value
  const total = params.total
  const label = _payload?.label || 'items'

  return chalk.cyan('⏳ ')
    + chalk.magenta('[')
    + chalk.blue(bar)
    + chalk.magenta('] ')
    + chalk.yellow(`${percentage}%`)
    + chalk.white(' | ')
    + chalk.green(`${value}`)
    + chalk.white('/')
    + chalk.green(`${total}`)
    + chalk.white(` ${label}`)
}

/**
 * Updates a progress bar safely (handles undefined progress bars)
 * @param progressBar The progress bar to update
 * @param increment Amount to increment (default: 1)
 */
export function updateProgressBar(
  progressBar: cliProgress.SingleBar | undefined,
  increment: number = 1,
): void {
  if (progressBar) {
    progressBar.increment(increment)
  }
}

/**
 * Stops a progress bar safely (handles undefined progress bars)
 * @param progressBar The progress bar to stop
 */
export function stopProgressBar(progressBar: cliProgress.SingleBar | undefined): void {
  if (progressBar) {
    progressBar.stop()
  }
}
