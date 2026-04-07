import { useCallback, useEffect, useState } from 'react'
import { permissionService } from '@src/service/permissionService'
import { buildAdminAccessProfile } from '@src/utils/adminAccess'
import { authService } from '@src/service/authService'

const toRoleObject = (role) => {
  if (!role) return null
  if (typeof role === 'string') {
    return {
      code: role,
      name: role,
    }
  }

  return {
    code: role.code || role.id || '',
    name: role.name || role.code || role.id || '',
  }
}

const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) return []
  return roles.map(toRoleObject).filter(Boolean)
}

const EMPTY_PROFILE = buildAdminAccessProfile([])

export const useAdminAccess = () => {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [organizationId, setOrganizationId] = useState('')
  const [permissionCodes, setPermissionCodes] = useState([])
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const userPermissions = await permissionService.getPermissions()
      const roles = normalizeRoles(userPermissions?.roles)
      const permissions = Array.isArray(userPermissions?.permissions) ? userPermissions.permissions : []
      const isPlatformAdmin = permissions.includes('*:*')
      const currentUser = authService.getState().user
      const fallbackOrganizationId = currentUser?.organization || ''

      setPermissionCodes(permissions)
      setOrganizationId(userPermissions?.organization || fallbackOrganizationId)
      setProfile(buildAdminAccessProfile(roles, { isPlatformAdmin }))
    } catch (err) {
      setError(err)
      setPermissionCodes([])
      setOrganizationId('')
      setProfile(EMPTY_PROFILE)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return {
    loading,
    profile,
    organizationId,
    permissionCodes,
    error,
    reload: load,
  }
}

export default useAdminAccess
