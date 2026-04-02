import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ManifestValidationError } from './PluginErrors'
import { PluginManifest } from './types'

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist'])

export interface ManifestArtifactResolution {
  artifactRoot: string
  manifestPath: string
  manifest: PluginManifest
}

async function statOrThrow(targetPath: string) {
  try {
    return await fs.stat(targetPath)
  } catch {
    throw new ManifestValidationError(`Artifact path does not exist: ${targetPath}`)
  }
}

export async function resolveManifestFromArtifact(artifactPath: string): Promise<ManifestArtifactResolution> {
  const absolutePath = path.resolve(artifactPath)
  const stats = await statOrThrow(absolutePath)

  const artifactRoot = stats.isDirectory() ? absolutePath : path.dirname(absolutePath)
  const manifestPath = stats.isDirectory() ? path.join(absolutePath, 'plugin.json') : absolutePath

  const manifestStats = await statOrThrow(manifestPath)
  if (!manifestStats.isFile()) {
    throw new ManifestValidationError(`Manifest is not a file: ${manifestPath}`)
  }

  if (path.basename(manifestPath) !== 'plugin.json') {
    throw new ManifestValidationError(`Manifest file must be named plugin.json: ${manifestPath}`)
  }

  let manifestRaw = ''
  try {
    manifestRaw = await fs.readFile(manifestPath, 'utf8')
  } catch {
    throw new ManifestValidationError(`Manifest file cannot be read: ${manifestPath}`)
  }

  let manifest: PluginManifest
  try {
    manifest = JSON.parse(manifestRaw) as PluginManifest
  } catch {
    throw new ManifestValidationError(`Manifest JSON parse failed: ${manifestPath}`)
  }

  return {
    artifactRoot,
    manifestPath,
    manifest,
  }
}

async function walkFiles(dir: string, relativePrefix = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absoluteEntryPath = path.join(dir, entry.name)
    const relativePath = path.join(relativePrefix, entry.name)

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      files.push(...(await walkFiles(absoluteEntryPath, relativePath)))
      continue
    }

    if (entry.isFile()) {
      files.push(relativePath)
    }
  }

  return files
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item))
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    const keys = Object.keys(input).sort((a, b) => a.localeCompare(b))
    const output: Record<string, unknown> = {}
    for (const key of keys) {
      output[key] = sortJsonValue(input[key])
    }
    return output
  }

  return value
}

export async function computeArtifactChecksum(artifactRoot: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  const files = await walkFiles(artifactRoot)
  files.sort((a, b) => a.localeCompare(b))

  for (const relativePath of files) {
    const absolutePath = path.join(artifactRoot, relativePath)
    let content = await fs.readFile(absolutePath)

    if (relativePath === 'plugin.json') {
      try {
        const manifestJson = JSON.parse(content.toString('utf8')) as Record<string, unknown>
        if (Object.hasOwn(manifestJson, 'checksum')) {
          delete manifestJson.checksum
        }
        content = Buffer.from(JSON.stringify(sortJsonValue(manifestJson)))
      } catch {
        // Keep raw plugin.json content if parsing fails.
      }
    }

    hash.update(relativePath.replace(/\\/g, '/'))
    hash.update('\n')
    hash.update(content)
    hash.update('\n')
  }

  return `sha256:${hash.digest('hex')}`
}

export function resolveArtifactFilePath(artifactRoot: string, relativePath: string): string {
  return path.resolve(artifactRoot, relativePath)
}

export async function ensureArtifactFileExists(
  artifactRoot: string,
  relativePath: string,
  fieldName: string,
): Promise<void> {
  const resolvedPath = resolveArtifactFilePath(artifactRoot, relativePath)
  let stats
  try {
    stats = await fs.stat(resolvedPath)
  } catch {
    throw new ManifestValidationError(`Manifest ${fieldName} file not found: ${relativePath}`)
  }

  if (!stats.isFile()) {
    throw new ManifestValidationError(`Manifest ${fieldName} must point to a file: ${relativePath}`)
  }
}
