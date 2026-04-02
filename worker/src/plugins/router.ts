import express from 'express'
import { WorkerApiRequest } from '../middleware/workerApiAuth'
import { DirectusPluginStore } from './DirectusPluginStore'
import { PluginError } from './PluginErrors'
import { PluginLifecycleService } from './PluginLifecycleService'
import { PluginRegistryService } from './PluginRegistryService'
import { PluginScopeType } from './types'

function asBoolean(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function buildActorContext(req: WorkerApiRequest) {
  const actor = (req.workerUser ?? {}) as Record<string, any>
  const requestIdHeader = req.headers['x-request-id']
  const requestId = typeof requestIdHeader === 'string' && requestIdHeader.trim() ? requestIdHeader.trim() : null
  return {
    actorId: typeof actor.id === 'string' ? actor.id : null,
    actorEmail: typeof actor.email === 'string' ? actor.email : null,
    requestId,
  }
}

function buildServices(req: WorkerApiRequest) {
  if (!req.workerAccessToken) {
    throw new PluginError('PLUGIN_AUTH_REQUIRED', 'Worker API token missing', 401)
  }
  const store = new DirectusPluginStore(req.workerAccessToken)
  return {
    store,
    registryService: new PluginRegistryService(store),
    lifecycleService: new PluginLifecycleService(store),
  }
}

async function writeRegistryAudit(
  req: WorkerApiRequest,
  payload: {
    action: string
    pluginId: string
    version: string
    success: boolean
    errorMessage?: string | null
    detail?: Record<string, unknown>
  },
) {
  if (!req.workerAccessToken) return

  try {
    const store = new DirectusPluginStore(req.workerAccessToken)
    const actor = buildActorContext(req)
    await store.createAuditLog({
      installation_id: null,
      plugin_id: payload.pluginId,
      version: payload.version,
      scope_type: null,
      scope_id: null,
      action: payload.action,
      from_status: null,
      to_status: null,
      actor_id: actor.actorId ?? null,
      actor_email: actor.actorEmail ?? null,
      request_id: actor.requestId ?? null,
      success: payload.success,
      error_message: payload.errorMessage ?? null,
      detail_json: payload.detail ?? null,
    })
  } catch (error) {
    console.warn('[PluginAPI] failed to persist registry audit log:', (error as any)?.message ?? error)
  }
}

function handlePluginError(res: express.Response, error: any) {
  if (error instanceof PluginError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    })
  }

  console.error('[PluginAPI] Unexpected error:', error?.message ?? error)
  return res.status(500).json({
    error: 'Plugin API internal error',
    code: 'PLUGIN_INTERNAL_ERROR',
  })
}

export function createPluginRouter() {
  const router = express.Router()

  router.post('/registry/install', async (req, res) => {
    const authReq = req as WorkerApiRequest
    try {
      const { registryService } = buildServices(authReq)
      const record = await registryService.installFromArtifact({
        artifactPath: String(req.body?.artifactPath ?? ''),
        pluginId: typeof req.body?.pluginId === 'string' ? req.body.pluginId : undefined,
        version: typeof req.body?.version === 'string' ? req.body.version : undefined,
      })
      await writeRegistryAudit(authReq, {
        action: 'registry.install',
        pluginId: record.plugin_id,
        version: record.version,
        success: true,
      })
      return res.status(200).json({ data: record })
    } catch (error: any) {
      const pluginId = typeof req.body?.pluginId === 'string' ? req.body.pluginId : 'unknown'
      const version = typeof req.body?.version === 'string' ? req.body.version : 'unknown'
      await writeRegistryAudit(authReq, {
        action: 'registry.install',
        pluginId,
        version,
        success: false,
        errorMessage: error?.message ?? 'registry.install failed',
      })
      return handlePluginError(res, error)
    }
  })

  router.post('/registry/:pluginId/:version/validate', async (req, res) => {
    const authReq = req as WorkerApiRequest
    const { pluginId, version } = req.params
    try {
      const { registryService } = buildServices(authReq)
      const record = await registryService.validate(pluginId, version)
      await writeRegistryAudit(authReq, {
        action: 'registry.validate',
        pluginId,
        version,
        success: true,
      })
      return res.status(200).json({ data: record })
    } catch (error: any) {
      await writeRegistryAudit(authReq, {
        action: 'registry.validate',
        pluginId,
        version,
        success: false,
        errorMessage: error?.message ?? 'registry.validate failed',
      })
      return handlePluginError(res, error)
    }
  })

  router.get('/registry', async (req, res) => {
    const authReq = req as WorkerApiRequest
    try {
      const { registryService } = buildServices(authReq)
      const records = await registryService.list({
        pluginId: typeof req.query.pluginId === 'string' ? req.query.pluginId : undefined,
        version: typeof req.query.version === 'string' ? req.query.version : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      })
      return res.status(200).json({ data: records })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.get('/registry/:pluginId/:version', async (req, res) => {
    const authReq = req as WorkerApiRequest
    const { pluginId, version } = req.params
    try {
      const { registryService } = buildServices(authReq)
      const record = await registryService.get(pluginId, version)
      return res.status(200).json({ data: record })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.post('/installations', async (req, res) => {
    const authReq = req as WorkerApiRequest
    const actor = buildActorContext(authReq)
    try {
      const { lifecycleService } = buildServices(authReq)
      const record = await lifecycleService.createInstallation(
        {
          pluginId: String(req.body?.pluginId ?? ''),
          version: String(req.body?.version ?? ''),
          scopeType: String(req.body?.scopeType ?? '') as PluginScopeType,
          scopeId: typeof req.body?.scopeId === 'string' ? req.body.scopeId : null,
          requestedPermissions: Array.isArray(req.body?.requestedPermissions)
            ? req.body.requestedPermissions
            : undefined,
          config:
            req.body?.config && typeof req.body.config === 'object' && !Array.isArray(req.body.config)
              ? req.body.config
              : undefined,
        },
        actor,
      )
      return res.status(201).json({ data: record })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.post('/installations/:installationId/enable', async (req, res) => {
    const authReq = req as WorkerApiRequest
    const actor = buildActorContext(authReq)
    try {
      const { lifecycleService } = buildServices(authReq)
      const record = await lifecycleService.enableInstallation(req.params.installationId, actor)
      return res.status(200).json({ data: record })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.post('/installations/:installationId/disable', async (req, res) => {
    const authReq = req as WorkerApiRequest
    const actor = buildActorContext(authReq)
    try {
      const { lifecycleService } = buildServices(authReq)
      const record = await lifecycleService.disableInstallation(req.params.installationId, actor)
      return res.status(200).json({ data: record })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.post('/installations/:installationId/upgrade', async (req, res) => {
    const authReq = req as WorkerApiRequest
    const actor = buildActorContext(authReq)
    try {
      const { lifecycleService } = buildServices(authReq)
      const record = await lifecycleService.upgradeInstallation(
        req.params.installationId,
        { targetVersion: String(req.body?.targetVersion ?? '') },
        actor,
      )
      return res.status(200).json({ data: record })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.delete('/installations/:installationId/uninstall', async (req, res) => {
    const authReq = req as WorkerApiRequest
    const actor = buildActorContext(authReq)
    try {
      const { lifecycleService } = buildServices(authReq)
      const record = await lifecycleService.uninstallInstallation(req.params.installationId, actor)
      return res.status(200).json({ data: record })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.get('/installations', async (req, res) => {
    const authReq = req as WorkerApiRequest
    try {
      const { lifecycleService } = buildServices(authReq)
      const records = await lifecycleService.listInstallations(
        {
          pluginId: typeof req.query.pluginId === 'string' ? req.query.pluginId : undefined,
          version: typeof req.query.version === 'string' ? req.query.version : undefined,
          type: typeof req.query.type === 'string' ? req.query.type : undefined,
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          scopeType: typeof req.query.scopeType === 'string' ? (req.query.scopeType as PluginScopeType) : undefined,
          scopeId: typeof req.query.scopeId === 'string' ? req.query.scopeId : undefined,
        },
        {
          includeManifest: asBoolean(req.query.includeManifest),
          effectiveScope:
            typeof req.query.effectiveScopeType === 'string' &&
            typeof req.query.effectiveScopeId === 'string' &&
            (req.query.effectiveScopeType === 'project' || req.query.effectiveScopeType === 'tenant')
              ? {
                  scopeType: req.query.effectiveScopeType,
                  scopeId: req.query.effectiveScopeId,
                }
              : undefined,
        },
      )
      return res.status(200).json({ data: records })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.get('/installations/:installationId', async (req, res) => {
    const authReq = req as WorkerApiRequest
    try {
      const { lifecycleService } = buildServices(authReq)
      const record = await lifecycleService.getInstallation(
        req.params.installationId,
        asBoolean(req.query.includeManifest),
      )
      return res.status(200).json({ data: record })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  router.get('/installations/:installationId/audit-logs', async (req, res) => {
    const authReq = req as WorkerApiRequest
    try {
      const { lifecycleService } = buildServices(authReq)
      const records = await lifecycleService.listAuditLogs(req.params.installationId)
      return res.status(200).json({ data: records })
    } catch (error) {
      return handlePluginError(res, error)
    }
  })

  return router
}
