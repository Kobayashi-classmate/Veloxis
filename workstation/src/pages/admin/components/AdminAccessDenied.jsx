import React from 'react'
import PropTypes from 'prop-types'
import { Button, Result } from 'antd'
import useSafeNavigate from '@app-hooks/useSafeNavigate'

const AdminAccessDenied = ({ message = '当前角色无权访问此管理模块。' }) => {
  const { redirectTo } = useSafeNavigate()

  return (
    <Result
      status="403"
      title="访问受限"
      subTitle={message}
      extra={
        <Button type="primary" onClick={() => redirectTo('/admin/overview')}>
          返回管理台首页
        </Button>
      }
    />
  )
}

AdminAccessDenied.propTypes = {
  message: PropTypes.string,
}

export default AdminAccessDenied
