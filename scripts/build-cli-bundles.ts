import { rm } from 'node:fs/promises'
import { build, fileURLToPath } from 'bun'
import { version } from '../package.json' with { type: 'json' }

const targets: Bun.Build.Target[] = (() => {
  return [
    'bun-linux-x64',
    'bun-linux-arm64',
    'bun-darwin-x64',
    'bun-darwin-arm64',
    'bun-windows-x64',
  ]
})()

const entryPoint = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url))

await rm(new URL('../bundles/', import.meta.url), { recursive: true, force: true })

const cliName = 'tacotruck'

for (const target of targets) {
  const [_, os, arch] = target.split('-')

  const fileName = `${cliName}-${version}-${os}-${arch}`

  const outFile = fileURLToPath(new URL(`../bundles/${fileName}`, import.meta.url))

  // eslint-disable-next-line no-console
  console.log(`Building ${cliName} for ${target} (result: ${fileName})...`)

  try {
    await build({
      entrypoints: [entryPoint],
      minify: true,
      compile: {
        target,
        outfile: outFile,
        windows: {

        },
      },
    })
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
