import assert from 'node:assert/strict'
import test from 'node:test'
import { CapabilityGuard } from '../CapabilityGuard'
import { PluginForbiddenError } from '../PluginErrors'

const guard = new CapabilityGuard()

test('CapabilityGuard resolves default granted permissions from manifest', () => {
  const granted = guard.resolveGrantedPermissions(['project:read', 'workbook:write'])
  assert.deepEqual(granted, ['project:read', 'workbook:write'])
})

test('CapabilityGuard rejects permissions outside manifest declaration', () => {
  assert.throws(
    () => guard.resolveGrantedPermissions(['project:read'], ['dataset:read']),
    (error: any) => error instanceof PluginForbiddenError && /not declared by manifest/.test(error.message),
  )
})

test('CapabilityGuard enforces scopeId for project scope', () => {
  assert.throws(
    () => guard.assertScope('project', ''),
    (error: any) => error instanceof PluginForbiddenError && /scopeId is required/.test(error.message),
  )
})
