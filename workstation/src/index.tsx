import ThemeIndex from './theme'
import { ProThemeProvider } from './theme/hooks'
import WatermarkProvider from '@/components/WatermarkProvider'
import { renderApp } from '@/bootstrap/renderApp'

renderApp({
  children: (
    <ProThemeProvider>
      {/* 后期变更为当前登录用户信息 */}
      <WatermarkProvider content="Veloxis Panel 水印">
        <ThemeIndex />
      </WatermarkProvider>
    </ProThemeProvider>
  ),
})
