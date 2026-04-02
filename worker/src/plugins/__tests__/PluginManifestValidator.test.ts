import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { PluginManifestValidator } from '../PluginManifestValidator'
import { ManifestValidationError } from '../PluginErrors'
import { computeArtifactChecksum } from '../artifactUtils'

const validator = new PluginManifestValidator({ platformVersion: '1.0.0' })

async function createTempPlugin(manifest: Record<string, unknown>, files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'veloxis-plugin-test-'))
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const absolutePath = path.join(dir, relativePath)
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content, 'utf8')
    }),
  )

  await fs.writeFile(path.join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8')

  return {
    dir,
    async cleanup() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
}

test('PluginManifestValidator validates official hello-chart manifest', async () => {
  const artifactPath = path.resolve(__dirname, '../../../../plugins/official/visualization/hello-chart')
  const result = await validator.validateFromArtifact(artifactPath)

  assert.equal(result.manifest.id, 'veloxis.plugin.visualization.hello-chart')
  assert.equal(result.manifest.type, 'visualization')
  assert.ok(result.artifactChecksum.startsWith('sha256:'))
})

test('PluginManifestValidator rejects runtime-entry mismatch', async () => {
  const fixture = await createTempPlugin(
    {
      id: 'veloxis.plugin.visualization.bad-entry',
      name: 'Bad Entry',
      version: '1.0.0',
      type: 'visualization',
      apiVersion: '1',
      publisher: 'veloxis',
      level: 'official-optional',
      runtime: ['ui'],
      entry: {
        worker: 'dist/worker.js',
      },
      permissions: ['project:read'],
      slots: ['workbook.chart.renderer'],
      configSchema: 'schemas/config.schema.json',
    },
    {
      'dist/worker.js': 'export default {}',
      'schemas/config.schema.json': '{}',
    },
  )

  try {
    await assert.rejects(
      () => validator.validateFromArtifact(fixture.dir),
      (error: any) => error instanceof ManifestValidationError && /entry\.ui/.test(error.message),
    )
  } finally {
    await fixture.cleanup()
  }
})

test('PluginManifestValidator rejects visualization without renderer/action slot', async () => {
  const fixture = await createTempPlugin(
    {
      id: 'veloxis.plugin.visualization.no-slot',
      name: 'No Slot',
      version: '1.0.0',
      type: 'visualization',
      apiVersion: '1',
      publisher: 'veloxis',
      level: 'official-optional',
      runtime: ['ui'],
      entry: {
        ui: 'dist/ui.js',
      },
      permissions: ['project:read'],
      slots: ['dataset.detail.panel'],
      configSchema: 'schemas/config.schema.json',
    },
    {
      'dist/ui.js': 'export default {}',
      'schemas/config.schema.json': '{}',
    },
  )

  try {
    await assert.rejects(
      () => validator.validateFromArtifact(fixture.dir),
      (error: any) => error instanceof ManifestValidationError && /renderer or workbook\.chart\.action/.test(error.message),
    )
  } finally {
    await fixture.cleanup()
  }
})

test('PluginManifestValidator validates checksum when declared', async () => {
  const baseManifest = {
    id: 'veloxis.plugin.visualization.checksum-ok',
    name: 'Checksum OK',
    version: '1.0.0',
    type: 'visualization',
    apiVersion: '1',
    publisher: 'veloxis',
    level: 'official-optional',
    runtime: ['ui'],
    entry: {
      ui: 'dist/ui.js',
    },
    permissions: ['project:read'],
    slots: ['workbook.chart.renderer'],
    configSchema: 'schemas/config.schema.json',
  }

  const fixture = await createTempPlugin(baseManifest, {
    'dist/ui.js': 'export default {}',
    'schemas/config.schema.json': '{}',
  })

  try {
    const checksum = await computeArtifactChecksum(fixture.dir)
    const manifestWithChecksum = {
      ...baseManifest,
      checksum,
    }
    await fs.writeFile(path.join(fixture.dir, 'plugin.json'), JSON.stringify(manifestWithChecksum, null, 2), 'utf8')

    const result = await validator.validateFromArtifact(fixture.dir)
    assert.equal(result.manifest.checksum, checksum)
  } finally {
    await fixture.cleanup()
  }
})

