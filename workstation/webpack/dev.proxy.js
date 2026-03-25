export default [
  // API 接口代理
  {
    context: ['/api'],
    target: 'http://localhost:8080',
    // pathRewrite: { '^/api': '' },
    secure: false,
    changeOrigin: true,
    cookieDomainRewrite: 'localhost',
  },
  // Faker 数据接口
  {
    context: ['/faker'],
    target: 'http://localhost:4000',
    pathRewrite: { '^/faker': '' },
    secure: false,
    changeOrigin: true,
    cookieDomainRewrite: 'localhost',
  },
]
