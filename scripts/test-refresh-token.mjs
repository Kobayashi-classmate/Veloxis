import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve('.env');
dotenv.config({ path: envPath });

const DIRECTUS_URL = `http://localhost:8080/api`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

async function testRefreshToken() {
    console.log('Testing refresh token functionality...\n');

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

        // 2. 使用access token进行API调用
        console.log('2. Making API call with access token...');
        const apiRes = await axios.get(`${DIRECTUS_URL}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✓ API call successful');
        console.log('User:', apiRes.data.data.email, '\n');

        // 3. 使用refresh token刷新access token
        console.log('3. Refreshing access token...');
        const refreshRes = await axios.post(`${DIRECTUS_URL}/auth/refresh`, {
            refresh_token: refreshToken
        });

        const newAccessToken = refreshRes.data.data.access_token;
        const newRefreshToken = refreshRes.data.data.refresh_token;

        console.log('✓ Token refresh successful');
        console.log('New access token:', newAccessToken.substring(0, 20) + '...');
        console.log('New refresh token:', newRefreshToken ? newRefreshToken.substring(0, 20) + '...' : 'null', '\n');

        // 4. 使用新的access token进行API调用
        console.log('4. Making API call with refreshed token...');
        const newApiRes = await axios.get(`${DIRECTUS_URL}/users/me`, {
            headers: { Authorization: `Bearer ${newAccessToken}` }
        });
        console.log('✓ API call with refreshed token successful');
        console.log('User:', newApiRes.data.data.email, '\n');

        // 5. 测试无效token的情况
        console.log('5. Testing with invalid token...');
        try {
            await axios.get(`${DIRECTUS_URL}/users/me`, {
                headers: { Authorization: `Bearer invalid_token` }
            });
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✓ Invalid token correctly rejected with 401');
            } else {
                console.log('✗ Unexpected error:', error.response?.status);
            }
        }

        console.log('\n🎉 All refresh token tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

testRefreshToken();