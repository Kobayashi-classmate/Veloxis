import { useOutletContext } from 'react-router-dom'
import { authService } from '@src/service/authService'
import { buildAdminAccessProfile } from '@src/utils/adminAccess'
import { useAdminAccess } from './useAdminAccess'

const EMPTY_PROFILE = buildAdminAccessProfile([])

export const useAdminOutlet = () => {
  const outletContext = useOutletContext() || {}
  const access = useAdminAccess()
  const actor = authService.getState().user?.email || authService.getState().user?.name || 'unknown'

  // 优先使用 Outlet 上下文（路由链路正常时）
  if (outletContext?.profile) {
    return {
      loading: false,
      profile: outletContext.profile,
      organizationId: outletContext.organizationId || '',
      permissionCodes: Array.isArray(outletContext.permissionCodes) ? outletContext.permissionCodes : [],
      actor: outletContext.actor || actor,
    }
  }

  // 回退到权限 Hook（兼容 Tabs/直渲染场景）
  return {
    loading: access.loading,
    profile: access.profile || EMPTY_PROFILE,
    organizationId: access.organizationId || '',
    permissionCodes: Array.isArray(access.permissionCodes) ? access.permissionCodes : [],
    actor,
  }
}

export default useAdminOutlet
