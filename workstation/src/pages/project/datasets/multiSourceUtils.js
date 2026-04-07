function normalizeStorageName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
}

export function canonicalizeStorageNames(names) {
  const set = new Set()
  names.forEach((name) => {
    const normalized = normalizeStorageName(name)
    if (normalized) set.add(normalized)
  })
  return Array.from(set).sort()
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fallbackHash(input) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
    .toString(16)
    .padStart(8, '0')
}

export async function computeSchemaFingerprintFromStorageNames(storageNames) {
  const canonical = canonicalizeStorageNames(storageNames)
  const payload = canonical.join('|')

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoded = new TextEncoder().encode(payload)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
    return bytesToHex(digest)
  }

  return fallbackHash(payload)
}

export function buildSourceFileSignature(file) {
  return [file?.name ?? '', file?.size ?? 0, file?.lastModified ?? 0].join('::')
}

export function buildSourceUnitId(sourceFileSignature, sheetName) {
  return `${sourceFileSignature}::${sheetName || '__csv__'}`
}

export function buildSchemaChildName(rootName, schemaOrder) {
  const suffix = String(schemaOrder).padStart(2, '0')
  return `${rootName}__schema_${suffix}`
}

export function groupSourceUnitsByFingerprint(sourceUnits) {
  const map = new Map()
  sourceUnits.forEach((unit) => {
    const key = unit.schemaFingerprint || 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        schemaFingerprint: key,
        sourceUnits: [],
      })
    }
    map.get(key).sourceUnits.push(unit)
  })

  return Array.from(map.values()).map((group, index) => ({
    ...group,
    schemaOrder: index + 1,
  }))
}

export function buildSourceGroups(sourceUnits, mergeSameSchema = true) {
  if (!Array.isArray(sourceUnits) || sourceUnits.length === 0) return []

  if (mergeSameSchema) {
    return groupSourceUnitsByFingerprint(sourceUnits).map((group) => ({
      ...group,
      groupKey: `schema:${group.schemaFingerprint || 'unknown'}`,
    }))
  }

  return sourceUnits.map((unit, index) => ({
    groupKey: `unit:${unit.id}`,
    schemaFingerprint: unit.schemaFingerprint || 'unknown',
    schemaOrder: index + 1,
    sourceUnits: [unit],
  }))
}
