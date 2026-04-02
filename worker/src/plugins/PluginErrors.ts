export class PluginError extends Error {
  code: string
  status: number
  details?: Record<string, unknown>

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

export class ManifestValidationError extends PluginError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PLUGIN_MANIFEST_INVALID', message, 400, details)
  }
}

export class PluginNotFoundError extends PluginError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PLUGIN_NOT_FOUND', message, 404, details)
  }
}

export class PluginConflictError extends PluginError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PLUGIN_CONFLICT', message, 409, details)
  }
}

export class PluginForbiddenError extends PluginError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PLUGIN_FORBIDDEN', message, 403, details)
  }
}
