import path from 'node:path'
import { fileURLToPath } from 'node:url'
import gradient from 'gradient-string'
import asyncStorage from '../utils/async-storage'
import { shouldShowAnimations, shouldUseColors } from '../utils/tty'

export const TACOTRUCK_TITLE = `
88888888888                    88888888888                        888      
    888                            888                            888      
    888                            888                            888      
    888   8888b.   .d8888b .d88b.  888  888d888 888  888  .d8888b 888  888 
    888      "88b d88P"   d88""88b 888  888P"   888  888 d88P"    888 .88P 
    888  .d888888 888     888  888 888  888     888  888 888      888888K  
    888  888  888 Y88b.   Y88..88P 888  888     Y88b 888 Y88b.    888 "88b 
    888  "Y888888  "Y8888P "Y88P"  888  888      "Y88888  "Y8888P 888  888
`

export const catppuccinTheme = {
  pink: '#F5C2E7',
  mauve: '#CBA6F7',
  red: '#F38BA8',
  maroon: '#E78284',
  peach: '#FAB387',
  yellow: '#F9E2AF',
  green: '#A6E3A1',
  teal: '#94E2D5',
  sky: '#89DCEB',
  sapphire: '#74C7EC',
  lavender: '#B4BEFE',
}

export function initPackageRoot(): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const packageRoot = path.resolve(__dirname, '../..')

  asyncStorage.setItem('packageRoot', packageRoot)
  return packageRoot
}

export function getPackageRoot(): string {
  return asyncStorage.getItem('packageRoot')
}

export function renderTitle() {
  if (!shouldShowAnimations()) {
    console.warn('TacoTruck - Test/QA data pipeline by TestFiesta')
    return
  }

  const terminalWidth = process.stdout.columns || 80
  const titleLines = TACOTRUCK_TITLE.split('\n')
  const titleWidth = Math.max(...titleLines.map(line => line.length))

  if (terminalWidth < titleWidth) {
    const simplifiedTitle = `
    ╔══════════════════╗
    ║  Taco Truck  ║
    ╚══════════════════╝
    `
    if (shouldUseColors()) {
      console.warn(
        gradient(Object.values(catppuccinTheme)).multiline(simplifiedTitle),
      )
    }
    else {
      console.warn(simplifiedTitle)
    }
  }
  else {
    if (shouldUseColors()) {
      console.warn(gradient(Object.values(catppuccinTheme)).multiline(TACOTRUCK_TITLE))
    }
    else {
      console.warn(TACOTRUCK_TITLE)
    }
  }
}
