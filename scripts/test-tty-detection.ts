#!/usr/bin/env tsx

import delay from 'delay'
import { renderTitle } from '../src/cli/utils'
import { createProgressBar } from '../src/utils/progress-bar'
import { createSpinner } from '../src/utils/spinner'
import { isInteractiveTTY, shouldShowAnimations, shouldShowProgressBars, shouldUseColors } from '../src/utils/tty'

async function testTTYDetection() {
  console.warn('=== TTY Detection Test ===')
  console.warn(`Interactive TTY: ${isInteractiveTTY()}`)
  console.warn(`Should show animations: ${shouldShowAnimations()}`)
  console.warn(`Should show progress bars: ${shouldShowProgressBars()}`)
  console.warn(`Should use colors: ${shouldUseColors()}`)
  console.warn('')

  console.warn('=== Title Rendering Test ===')
  renderTitle()
  console.warn('')

  console.warn('=== Spinner Test ===')
  const spinner = createSpinner()
  spinner.start('Testing spinner functionality...')
  await delay(1000)
  spinner.message('Processing items...')
  await delay(1000)
  spinner.stop('Spinner test completed')
  console.warn('')

  console.warn('=== Progress Bar Test ===')
  const progressBar = createProgressBar({
    total: 5,
    label: 'test items',
  })

  if (progressBar) {
    for (let i = 0; i < 5; i++) {
      await delay(500)
      progressBar.increment()
    }
    progressBar.stop()
  }
  else {
    console.warn('Progress bar disabled (non-TTY environment)')
    for (let i = 1; i <= 5; i++) {
      await delay(500)
      console.warn(`Processing: ${i}/5 test items`)
    }
  }

  console.warn('')
  console.warn('=== Interactive Prompts Test ===')
  if (shouldShowAnimations()) {
    console.warn('Interactive prompts will be shown in CLI commands')
  }
  else {
    console.warn('Interactive prompts will be disabled - CLI will use defaults or require explicit flags')
  }

  console.warn('')
  console.warn('=== Test Complete ===')
  console.warn('Try running this script with different outputs:')
  console.warn('  tsx scripts/test-tty-detection.ts        # Interactive')
  console.warn('  tsx scripts/test-tty-detection.ts | cat  # Piped')
  console.warn('  tsx scripts/test-tty-detection.ts > out  # Redirected')
  console.warn('')
  console.warn('CLI behavior examples:')
  console.warn('  Interactive: tacotruck testrail project:create --name "Test" --token "xxx" --url "https://test.testrail.io"')
  console.warn('  Non-interactive: Same command will use default suite mode (1) without prompting')
  console.warn('  Non-interactive delete: Requires --force flag instead of confirmation prompt')
}

testTTYDetection().catch(console.error)
