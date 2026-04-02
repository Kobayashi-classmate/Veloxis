import { PluginRuntime } from './types'

export const ALLOWED_PLUGIN_TYPES = new Set([
  'operator',
  'datasource',
  'visualization',
  'ai-capability',
  'action-integration',
])

export const ALLOWED_PLUGIN_LEVELS = new Set([
  'official-built-in',
  'official-optional',
  'controlled-custom',
])

export const ALLOWED_RUNTIMES = new Set<PluginRuntime>(['ui', 'worker', 'query'])

export const ALLOWED_SLOTS = new Set([
  'project.copilot.sidebar',
  'dataset.detail.panel',
  'model.detail.panel',
  'workbook.chart.renderer',
  'workbook.chart.action',
  'recipe.operator.library',
])

export const ALLOWED_EVENTS = new Set([
  'dataset.created',
  'dataset.version.ready',
  'dataset.version.failed',
  'recipe.saved',
  'recipe.executed',
  'workbook.created',
  'workbook.saved',
  'ai.answer.generated',
])

export const ALLOWED_HOOKS = new Set([
  'recipe.operator.execute',
  'ingestion.pre-parse',
  'ingestion.post-parse',
  'export.generate',
  'notification.dispatch',
])

export const ALLOWED_PERMISSIONS = new Set([
  'project:read',
  'project:write',
  'dataset:read',
  'dataset:write',
  'recipe:read',
  'recipe:write',
  'recipe:execute',
  'metric:read',
  'workbook:read',
  'workbook:write',
  'model:read',
  'notification:send',
])

export const INSTALLATION_TRANSITIONS: Record<string, Set<string>> = {
  packaged: new Set(['installed']),
  installed: new Set(['validated', 'enabled', 'disabled', 'upgraded', 'uninstalled']),
  validated: new Set(['enabled', 'disabled', 'upgraded', 'uninstalled']),
  enabled: new Set(['suspended', 'disabled', 'upgraded', 'uninstalled']),
  suspended: new Set(['enabled', 'disabled', 'upgraded', 'uninstalled']),
  upgraded: new Set(['enabled', 'disabled', 'uninstalled']),
  disabled: new Set(['enabled', 'upgraded', 'uninstalled']),
  uninstalled: new Set([]),
  error: new Set(['disabled']),
}
