import { rm } from 'node:fs/promises'
import { $, fileURLToPath } from 'bun'
import { version } from '../package.json' with { type: 'json' }

const targets = (() => {
  if (process.env.TACOTRUCK_FULL_CLI_BUNDLES) {
    return [
      'bun-windows-x64',
      'bun-windows-x64-baseline',
      'bun-linux-x64',
      'bun-linux-x64-baseline',
      'bun-linux-arm64',
      'bun-linux-arm64-baseline',
      'bun-darwin-x64',
      'bun-darwin-x64-baseline',
      'bun-darwin-arm64',
      'bun-darwin-arm64-baseline',
      'bun-linux-x64-musl',
      'bun-linux-arm64-musl',
      'bun-linux-x64-musl-baseline',
      'bun-linux-arm64-musl-baseline',
    ]
  }

  return [
    'bun-linux-x64',
    'bun-linux-x64-baseline',
    'bun-linux-arm64',
    'bun-linux-arm64-baseline',
    'bun-darwin-x64',
    'bun-darwin-x64-baseline',
    'bun-darwin-arm64',
    'bun-darwin-arm64-baseline',
    'bun-linux-x64-musl',
    'bun-linux-arm64-musl',
    'bun-linux-x64-musl-baseline',
    'bun-linux-arm64-musl-baseline',
  ]
})()

const entryPoint = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url))

await rm(new URL('../bundles/', import.meta.url), { recursive: true, force: true })

const cliName = 'tacotruck'

for (const target of targets) {
  const [, os, arch, musl, baseline] = target.split('-')

  const finalArch = arch
  let finalMusl = musl
  let finalBaseline = baseline

  if (musl === 'baseline') {
    finalMusl = ''
    finalBaseline = 'baseline'
  }

  const fileName = `${cliName}-${version}-${os}-${finalArch}${finalMusl ? '-musl' : ''}${finalBaseline ? '-baseline' : ''}`

  const outFile = fileURLToPath(new URL(`../bundles/${fileName}`, import.meta.url))

  // eslint-disable-next-line no-console
  console.log(`Building ${cliName} for ${target} (result: ${fileName})...`)

  try {
    await $`bun build --compile --minify --target=${target} --outfile=${outFile} ${entryPoint}`
    // eslint-disable-next-line no-console
    console.log(`✅ Successfully built ${fileName}`)
  }
  catch (buildError) {
    console.error(`❌ Failed to build ${fileName}:`, buildError)
  }
}

// eslint-disable-next-line no-console
console.log('🎉 Bundle creation completed!')
// eslint-disable-next-line no-console
console.log(`📦 Bundles created in: ${fileURLToPath(new URL('../bundles/', import.meta.url))}`)
