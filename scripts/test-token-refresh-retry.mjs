import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve('.env');
dotenv.config({ path: envPath });

const DIRECTUS_URL = `http://localhost:8080/api`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

async function testTokenRefreshAndRetry() {
    console.log('Testing token refresh and automatic retry functionality...\n');

    try {
        // 1. 登录获取tokens
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${DIRECTUS_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });

        const accessToken = loginRes.data.data.access_token;
        const refreshToken = loginRes.data.data.refresh_token;

        console.log('✓ Login successful');
        console.log('Access token:', accessToken.substring(0, 20) + '...');
        console.log('Refresh token:', refreshToken.substring(0, 20) + '...\n');

        // 2. 使用有效的token进行API调用
        console.log('2. Making API call with valid token...');
        const apiRes = await axios.get(`${DIRECTUS_URL}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✓ API call successful');
        console.log('User:', apiRes.data.data.email, '\n');

        // 3. 模拟使用过期的token（使用一个假的过期token）
        console.log('3. Simulating expired token scenario...');
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNjgzNjQ4MDAwLCJleHAiOjE2ODM2NDgwMDB9.invalid';

        try {
            await axios.get(`${DIRECTUS_URL}/users/me`, {
                headers: { Authorization: `Bearer ${expiredToken}` }
            });
            console.log('✗ Expected 401 error but request succeeded');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✓ Correctly received 401 for expired token');
            } else {
                console.log('✗ Unexpected error:', error.response?.status);
            }
        }

        // 4. 测试刷新token接口
        console.log('4. Testing refresh token endpoint...');
        const refreshRes = await axios.post(`${DIRECTUS_URL}/auth/refresh`, {
            refresh_token: refreshToken
        });

        const newAccessToken = refreshRes.data.data.access_token;
        console.log('✓ Token refresh successful');
        console.log('New access token:', newAccessToken.substring(0, 20) + '...\n');

        // 5. 使用新的token验证
        console.log('5. Verifying new token works...');
        const newApiRes = await axios.get(`${DIRECTUS_URL}/users/me`, {
            headers: { Authorization: `Bearer ${newAccessToken}` }
        });
        console.log('✓ New token works correctly');
        console.log('User:', newApiRes.data.data.email, '\n');

        console.log('🎉 All token refresh tests passed!');
        console.log('\nNote: The automatic retry functionality would need to be tested');
        console.log('in the actual frontend application with expired tokens.');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

testTokenRefreshAndRetry();