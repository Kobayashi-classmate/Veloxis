// OAuth Hook
import { message } from 'antd'

export function useOAuth() {
  const loginWithGoogle = () => {
    try {
      window.location.href = '/api/auth/google'
    } catch {
      message.error('Google登录失败，请重试')
    }
  }

  return {
    loginWithGoogle,
  }
}
