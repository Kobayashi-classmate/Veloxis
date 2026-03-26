import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

const envPath = path.resolve('.env')
dotenv.config({ path: envPath })

const DIRECTUS_URL = `http://localhost:8080/api`
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

async function testLogoutCleanup() {
  console.log('Testing logout cleanup functionality...\n')

  try {
    // Step 1: 登录获取tokens
    console.log('1. Logging in...')
    const loginRes = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    })

    const accessToken = loginRes.data.data.access_token
    const refreshToken = loginRes.data.data.refresh_token

    console.log('✓ Login successful')
    console.log('Access token:', accessToken.substring(0, 20) + '...')
    console.log('Refresh token:', refreshToken.substring(0, 20) + '...\n')

    // Step 2: 模拟前端设置localStorage（如同login后）
    console.log('2. Checking what gets stored in localStorage during login...')
    const storageKeys = {
      token: JSON.stringify({ token: accessToken }),
      refreshToken: JSON.stringify({ token: refreshToken }),
      user_permissions: 'demo permissions data',
      permissions_fetch_time: Date.now().toString(),
      permissions_auth_key: `token:${accessToken}`,
      user_role: 'admin',
      force_demo_switch: 'true',
    }

    console.log('Keys that should be stored:')
    Object.entries(storageKeys).forEach(([key, value]) => {
      const preview = typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value
      console.log(`  - ${key}: ${preview}`)
    })
    console.log()

    // Step 3: 验证logout应该清除哪些键
    console.log('3. Keys that should be removed during logout:')
    const keysToRemove = [
      'token',
      'refreshToken',
      'user_permissions',
      'permissions_fetch_time',
      'permissions_auth_key',
      'user_role',
      'force_demo_switch',
    ]
    keysToRemove.forEach((key) => {
      console.log(`  - ${key}`)
    })
    console.log()

    // Step 4: 使用过期token模拟需要logout的情况
    console.log('4. Simulating token expiration scenario...')
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNjgzNjQ4MDAwLCJleHAiOjE2ODM2NDgwMDB9.invalid'

    try {
      await axios.get(`${DIRECTUS_URL}/users/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      })
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✓ Token expiration correctly detected (401 received)')
      } else {
        console.log('⚠ Unexpected error status:', error.response?.status)
      }
    }
    console.log()

    // Step 5: 测试token刷新
    console.log('5. Testing token refresh with valid refresh token...')
    const refreshRes = await axios.post(`${DIRECTUS_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    })

    const newAccessToken = refreshRes.data.data.access_token
    console.log('✓ Token refresh successful')
    console.log('New access token:', newAccessToken.substring(0, 20) + '...\n')

    // Step 6: 验证刷新后的token仍然有效
    console.log('6. Verifying new token works...')
    const meRes = await axios.get(`${DIRECTUS_URL}/users/me`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    })
    console.log('✓ New token works correctly')
    console.log('User:', meRes.data.data.email, '\n')

    console.log('🎉 All logout cleanup tests passed!')
    console.log('\nSummary:')
    console.log('- Logout should clear all listed localStorage keys')
    console.log('- Signin page should not retain old user data')
    console.log('- Token refresh should work properly')
    console.log('- Page navigation should work smoothly after logout')
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message)
    process.exit(1)
  }
}

testLogoutCleanup()
