import packageJson from '../../package.json'

export function getVersion(): string {
  return packageJson.version
}

export function getUserAgent(): string {
  const version = getVersion()
  return `TacoTruck CLI ${version}`
}
