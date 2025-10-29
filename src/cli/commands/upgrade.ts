import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import { execa } from 'execa'
import { ofetch } from 'ofetch'
import { createSpinner } from '../../utils/spinner'
import { getVersion } from '../../utils/version'

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
  prerelease: boolean
  assets: Array<{
    name: string
    browser_download_url: string
  }>
}

interface UpgradeOptions {
  target?: string
  force?: boolean
}

export function createUpgradeCommand(): Command {
  const command = new Command('upgrade')
    .description('Upgrade TacoTruck CLI to the latest version or a specific version')
    .option('-t, --target <version>', 'Specific version to upgrade to (e.g., 1.0.0-beta.25)')
    .option('-f, --force', 'Force upgrade even if already on the latest version')
    .action(async (options: UpgradeOptions) => {
      try {
        await handleUpgrade(options)
      }
      catch (error) {
        p.cancel(`Upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        process.exit(1)
      }
    })

  return command
}

async function handleUpgrade(options: UpgradeOptions): Promise<void> {
  const currentVersion = getVersion()

  p.intro('TacoTruck CLI Upgrade')

  let targetVersion: string

  if (options.target) {
    targetVersion = options.target.replace(/^v/, '')
  }
  else {
    const spinner = createSpinner()
    spinner.start('Checking for latest version...')

    try {
      targetVersion = await getLatestVersion()
      spinner.stop('Latest version checked')
    }
    catch (error) {
      spinner.stop('Failed to check latest version')

      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.'
        }
        else if (error.message.includes('rate limit')) {
          errorMessage = 'GitHub API rate limit exceeded. Please try again later.'
        }
        else {
          errorMessage = error.message
        }
      }

      throw new Error(`Failed to fetch latest version: ${errorMessage}`)
    }
  }

  if (!options.force && currentVersion === targetVersion) {
    p.outro(`You're already on the latest version (${currentVersion})`)
    return
  }

  if (!options.force) {
    const shouldUpgrade = await p.confirm({
      message: `Upgrade from ${currentVersion} to ${targetVersion}?`,
      initialValue: true,
    })

    if (p.isCancel(shouldUpgrade) || !shouldUpgrade) {
      p.cancel('Upgrade cancelled')
      return
    }
  }

  const method = await detectInstallationMethod()

  p.log.info(`Upgrading to version ${targetVersion} using ${method} method`)

  switch (method) {
    case 'standalone':
      await upgradeStandalone(targetVersion)
      break
    case 'npm':
      await upgradePackageManager(targetVersion, 'npm')
      break
    case 'bun':
      await upgradePackageManager(targetVersion, 'bun')
      break
    case 'pnpm':
      await upgradePackageManager(targetVersion, 'pnpm')
      break
    case 'homebrew':
      await upgradeHomebrew(targetVersion)
      break
    default:
      throw new Error(`Unsupported installation method: ${method}`)
  }

  await verifyUpgrade(targetVersion)

  p.outro(`Successfully upgraded to TacoTruck CLI ${targetVersion}!`)
}

async function getLatestVersion(): Promise<string> {
  try {
    const latestRelease = await ofetch<GitHubRelease>(
      'https://api.github.com/repos/testfiesta/tacotruck/releases/latest',
    )

    if (latestRelease?.tag_name) {
      return latestRelease.tag_name.replace(/^v/, '')
    }
  }
  catch {
    p.log.warning('No stable release found, checking for pre-releases...')
  }

  const releases = await ofetch<GitHubRelease[]>(
    'https://api.github.com/repos/testfiesta/tacotruck/releases',
  )

  if (!releases || releases.length === 0) {
    throw new Error('No releases found')
  }

  return releases[0].tag_name.replace(/^v/, '')
}

async function detectInstallationMethod(): Promise<'standalone' | 'npm' | 'bun' | 'pnpm' | 'homebrew'> {
  try {
    const executablePath = process.argv[1]

    if (executablePath.includes('/opt/homebrew/') || executablePath.includes('/usr/local/')) {
      try {
        const result = await execa('brew', ['list', '--formula'], { reject: false })
        if (result.stdout.includes('tacotruck')) {
          return 'homebrew'
        }
      }
      catch {
        // Homebrew not available or error, continue with other checks
      }
    }

    if (executablePath.includes('node_modules')) {
      const packageManager = await detectPackageManager()
      return packageManager
    }

    const homeDir = os.homedir()
    const tacotruckDir = path.join(homeDir, '.tacotruck')

    if (executablePath.startsWith(tacotruckDir)) {
      return 'standalone'
    }

    return 'standalone'
  }
  catch {
    return 'standalone'
  }
}

async function detectPackageManager(): Promise<'npm' | 'bun' | 'pnpm'> {
  const cwd = process.cwd()

  if (fs.existsSync(path.join(cwd, 'bun.lockb'))) {
    return 'bun'
  }

  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
    return 'npm'
  }

  try {
    await execa('bun', ['pm', 'ls', '-g'], { reject: false })
    const bunResult = await execa('bun', ['pm', 'ls', '-g'], { reject: false })
    if (bunResult.stdout.includes('@testfiesta/tacotruck')) {
      return 'bun'
    }
  }
  catch {
    // Bun not available or error
  }

  try {
    const pnpmResult = await execa('pnpm', ['list', '-g', '@testfiesta/tacotruck'], { reject: false })
    if (pnpmResult.exitCode === 0) {
      return 'pnpm'
    }
  }
  catch {
    // pnpm not available or error
  }

  return 'npm'
}

async function upgradeStandalone(version: string): Promise<void> {
  const spinner = createSpinner()
  spinner.start('Upgrading standalone installation...')

  try {
    const platform = getPlatform()
    const homeDir = os.homedir()
    const installDir = process.env.TACOTRUCK_CLI_INSTALL || path.join(homeDir, '.tacotruck')
    const binDir = path.join(installDir, 'bin')

    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true })
    }

    const downloadUrl = `https://github.com/testfiesta/tacotruck/releases/download/v${version}/tacotruck-${version}-${platform}`
    const binaryPath = path.join(binDir, 'tacotruck')
    const tempPath = `${binaryPath}.tmp`

    spinner.message('Downloading new version...')

    await execa('curl', [
      '--fail',
      '--location',
      '--progress-bar',
      '--output',
      tempPath,
      downloadUrl,
    ])

    await execa('chmod', ['+x', tempPath])

    if (fs.existsSync(binaryPath)) {
      fs.unlinkSync(binaryPath)
    }
    fs.renameSync(tempPath, binaryPath)

    spinner.stop('Standalone installation upgraded successfully')
  }
  catch (error) {
    spinner.stop('Standalone upgrade failed')

    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        errorMessage = `Version ${version} not found. Please check if this version exists on GitHub releases.`
      }
      else if (error.message.includes('curl')) {
        errorMessage = `Download failed. Please check your internet connection and try again.`
      }
      else {
        errorMessage = error.message
      }
    }

    throw new Error(`Failed to upgrade standalone installation: ${errorMessage}`)
  }
}

async function upgradePackageManager(version: string, packageManager: 'npm' | 'bun' | 'pnpm'): Promise<void> {
  const spinner = createSpinner()
  spinner.start(`Upgrading ${packageManager} installation...`)

  try {
    const isGlobal = await isGlobalPackageInstall(packageManager)

    let args: string[]

    switch (packageManager) {
      case 'npm':
        args = ['install', `@testfiesta/tacotruck@${version}`]
        if (isGlobal) {
          args.splice(1, 0, '-g')
        }
        break
      case 'bun':
        args = ['add', `@testfiesta/tacotruck@${version}`]
        if (isGlobal) {
          args.splice(1, 0, '-g')
        }
        break
      case 'pnpm':
        args = ['add', `@testfiesta/tacotruck@${version}`]
        if (isGlobal) {
          args.splice(1, 0, '-g')
        }
        break
      default:
        throw new Error(`Unsupported package manager: ${packageManager}`)
    }

    spinner.message(`Installing new version via ${packageManager}...`)

    await execa(packageManager, args, {
      stdio: 'pipe', // Suppress package manager output
    })

    spinner.stop(`${packageManager} installation upgraded successfully`)
  }
  catch (error) {
    spinner.stop(`${packageManager} upgrade failed`)

    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('E404')) {
        errorMessage = `Version ${version} not found in ${packageManager} registry.`
      }
      else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
        errorMessage = `Network error. Please check your internet connection and try again.`
      }
      else if (error.message.includes('permission') || error.message.includes('EACCES')) {
        errorMessage = `Permission denied. Try running with sudo or check your ${packageManager} permissions.`
      }
      else {
        errorMessage = error.message
      }
    }

    throw new Error(`Failed to upgrade ${packageManager} installation: ${errorMessage}`)
  }
}

async function isGlobalPackageInstall(packageManager: 'npm' | 'bun' | 'pnpm'): Promise<boolean> {
  try {
    let args: string[]

    switch (packageManager) {
      case 'npm':
        args = ['list', '-g', '@testfiesta/tacotruck']
        break
      case 'bun':
        args = ['pm', 'ls', '-g']
        break
      case 'pnpm':
        args = ['list', '-g', '@testfiesta/tacotruck']
        break
      default:
        return false
    }

    const result = await execa(packageManager, args, {
      reject: false,
    })

    if (packageManager === 'bun') {
      return result.stdout.includes('@testfiesta/tacotruck')
    }

    return result.exitCode === 0
  }
  catch {
    return false
  }
}

function getPlatform(): string {
  const platform = os.platform()
  const arch = os.arch()

  let target: string

  switch (platform) {
    case 'darwin':
      target = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
      break
    case 'linux':
      target = arch === 'arm64' ? 'linux-arm64' : 'linux-x64'
      break
    case 'win32':
      target = 'windows-x64'
      break
    default:
      target = 'linux-x64'
  }

  // Check for musl on Linux
  if (platform === 'linux') {
    try {
      if (fs.existsSync('/etc/alpine-release')) {
        target += '-musl'
      }
    }
    catch {
      // Ignore error, use regular linux build
    }
  }

  return target
}

async function upgradeHomebrew(version: string): Promise<void> {
  const spinner = createSpinner()
  spinner.start('Upgrading Homebrew installation...')

  try {
    spinner.message('Upgrading TacoTruck...')
    await execa('brew', ['upgrade', 'testfiesta/tacotruck/tacotruck'], {
      stdio: 'pipe', // Suppress brew output
    })

    spinner.stop('Homebrew installation upgraded successfully')
  }
  catch (error) {
    spinner.stop('Homebrew upgrade failed')

    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      if (error.message.includes('No available formula')) {
        errorMessage = `Version ${version} not available in Homebrew tap. The tap may need to be updated.`
      }
      else if (error.message.includes('already installed')) {
        errorMessage = 'TacoTruck is already up to date via Homebrew.'
      }
      else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.'
      }
      else if (error.message.includes('permission') || error.message.includes('EACCES')) {
        errorMessage = 'Permission denied. Please check your Homebrew permissions.'
      }
      else {
        errorMessage = error.message
      }
    }

    throw new Error(`Failed to upgrade Homebrew installation: ${errorMessage}`)
  }
}

async function verifyUpgrade(expectedVersion: string): Promise<void> {
  const spinner = createSpinner()
  spinner.start('Verifying upgrade...')

  try {
    const result = await execa('tacotruck', ['--version'], {
      timeout: 10000, // 10 second timeout
    })

    const installedVersion = result.stdout.trim()

    if (installedVersion === expectedVersion) {
      spinner.stop('Upgrade verified successfully')
    }
    else {
      spinner.stop('Upgrade verification failed')
      throw new Error(`Expected version ${expectedVersion}, but got ${installedVersion}`)
    }
  }
  catch (error) {
    spinner.stop('Upgrade verification failed')

    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Verification timed out. The upgrade may have succeeded, please check manually with: tacotruck --version'
      }
      else if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
        errorMessage = 'TacoTruck command not found after upgrade. Please check your PATH or restart your terminal.'
      }
      else {
        errorMessage = error.message
      }
    }

    throw new Error(`Failed to verify upgrade: ${errorMessage}`)
  }
}
