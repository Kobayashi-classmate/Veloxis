import React, { useMemo } from 'react'
import { Space, Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAccess } from '../hooks/useAdminAccess'
import AdminAccessDenied from '../components/AdminAccessDenied'
import { authService } from '@src/service/authService'

const normalizePath = (value = '') => {
  const path = String(value || '').split('?')[0]
  if (!path) return '/admin/overview'
  return path.replace(/\/$/, '') || '/'
}

const AdminLayout = () => {
  const { pathname } = useLocation()
  const { loading, profile, tenantId, permissionCodes } = useAdminAccess()
  const currentPath = normalizePath(pathname)

  const actor = authService.getState().user?.email || authService.getState().user?.name || 'unknown'

  const canVisitCurrent = useMemo(() => {
    if (currentPath === '/admin') return true
    return profile.allowedPaths.includes(currentPath)
  }, [currentPath, profile.allowedPaths])

  if (loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
        <Space direction="vertical" align="center">
          <Spin size="large" />
          <span>Loading Admin Console...</span>
        </Space>
      </div>
    )
  }

  if (!profile.isAdminConsoleUser) {
    return <Navigate to="/403" replace />
  }

  if (!canVisitCurrent) {
    return <AdminAccessDenied message="该管理模块超出当前角色权限边界。" />
  }

  return (
    <Outlet
      context={{
        profile,
        tenantId,
        permissionCodes,
        actor,
      }}
    />
  )
}

export default AdminLayout
