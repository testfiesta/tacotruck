import gradient from 'gradient-string'

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

export function renderTitle() {
  const terminalWidth = process.stdout.columns || 80
  const titleLines = TACOTRUCK_TITLE.split('\n')
  const titleWidth = Math.max(...titleLines.map(line => line.length))

  if (terminalWidth < titleWidth) {
    const simplifiedTitle = `
    ╔══════════════════╗
    ║  Taco Truck  ║
    ╚══════════════════╝
    `
    console.log(
      gradient(Object.values(catppuccinTheme)).multiline(simplifiedTitle),
    )
  }
  else {
    console.log(gradient(Object.values(catppuccinTheme)).multiline(TACOTRUCK_TITLE))
  }
}
