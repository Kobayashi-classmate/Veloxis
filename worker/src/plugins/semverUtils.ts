import { ManifestValidationError } from './PluginErrors'

type ParsedVersion = {
  major: number
  minor: number
  patch: number
}

function parseVersion(raw: string): ParsedVersion | null {
  const match = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function compareVersion(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

export function assertSemver(version: string, fieldName: string): void {
  if (!parseVersion(version)) {
    throw new ManifestValidationError(`Manifest ${fieldName} must be a strict semver string (x.y.z): ${version}`)
  }
}

export function isPlatformVersionCompatible(range: string | undefined, platformVersion: string): boolean {
  if (!range || !range.trim()) return true

  const normalizedRange = range.trim()
  if (normalizedRange === '*') return true

  const parsedPlatform = parseVersion(platformVersion)
  if (!parsedPlatform) {
    throw new ManifestValidationError(`Invalid host platform version: ${platformVersion}`)
  }

  if (normalizedRange.startsWith('^')) {
    const baseVersion = parseVersion(normalizedRange.slice(1))
    if (!baseVersion) return false

    if (parsedPlatform.major !== baseVersion.major) return false
    return compareVersion(parsedPlatform, baseVersion) >= 0
  }

  if (normalizedRange.startsWith('>=')) {
    const lowerBound = parseVersion(normalizedRange.slice(2).trim())
    if (!lowerBound) return false
    return compareVersion(parsedPlatform, lowerBound) >= 0
  }

  if (normalizedRange.startsWith('<=')) {
    const upperBound = parseVersion(normalizedRange.slice(2).trim())
    if (!upperBound) return false
    return compareVersion(parsedPlatform, upperBound) <= 0
  }

  const exact = parseVersion(normalizedRange)
  if (exact) {
    return compareVersion(parsedPlatform, exact) === 0
  }

  return false
}
