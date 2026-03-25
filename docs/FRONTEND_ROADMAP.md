# Veloxis 前端开发路线图 (Frontend Roadmap V1)

基于最新版本的《Veloxis 前端架构与规范 V1 (基于 Pro-React-Admin)》，为确保 500+ 高并发交互的稳定性和复杂 BI 业务的顺利落地，特制订本前端开发路线图。本次交付划分为 5 个核心里程碑（Milestones），充分利用脚手架基建优势，建议与后端的 Sprint 计划对齐推进。

---

## 🚩 Milestone 1: 脚手架重构与全局鉴权 (Infrastructure & Auth)
**目标**：拉取开源企业级基座进行“大瘦身”，确立“红蓝双修”状态架构，落实 "Deep Data" 主题，全面打通与 Directus 控制面的安全鉴权链路。

- [ ] **基座引入与外科手术式重构**：拉取 `pro-react-admin` 脚手架，剥离强业务绑定的 Mock 数据与多余视图Demo，保留核心的 `KeepAlive`、`ProTabs` 多标签页机制与原生请求层骨架。
- [ ] **主题规范落地**：覆盖脚手架原有的 AntD Default Theme，配置 Tailwind CSS 与 `ConfigProvider`，注入 5 大核心色（Deep Sapphire, Ghost Gray, Abyss Black, Emerald Green, Crimson/Amber）。
- [ ] **网络层改造**：改造脚手架内置的高级请求库，配置 Axios 拦截器（自动挂载 `Bearer Token` 与 `X-Project-Id`，统一处理 401/403 及 Step-up 挂起回放逻辑）。
- [ ] **状态库并行基建**：确立红蓝双修架构。保留 Redux 处理路由与 Tabs，初始化 Zustand 并建立 `useAuthStore` 承接细粒度交互逻辑。
- [ ] **统一安全门禁 (/login)**：改造脚手架登录页，接入 Directus 真实接口，包含基础账密输入与 TOTP 动态码验证 UI。
- [ ] **全局控制台 (/global-console)**：开发首屏布局，包含时钟、最近足迹看板、异常监控警报灯静态骨架。
- [ ] **多项目大厅 (/workspaces)**：开发基于 Directus RBAC 权限过滤的项目卡片列表视图，限定为前台业务唯一主干入口。

---

## 🚩 Milestone 2: 项目上下文与数据基座 (Context & Data Modeling)
**目标**：确立项目级工作空间边界，完成数据集的展示与视图构建器的雏形，接入 Cube.js 查询终端。

- [ ] **项目工作空间框架 (/project/:id)**：利用脚手架的动态路由引擎，开发项目级嵌套路由与左侧导航侧边栏，隔离跨项目操作。
- [ ] **项目状态管理**：实现 `useProjectStore` (Zustand)，路由切入即拉取并缓存当前项目相关的环境变量与数据字典。
- [ ] **数据集列表 (/models - 物理表)**：展示从前端导入到 Doris Staging 表的物理数据集及其版本时间线（Dataset_Versions）。
- [ ] **Cube.js 客户端接入**：配置 `@cubejs-client/react` 以及对应的 Websocket/轮询长连接 Hooks。
- [ ] **视图构建器原型 (/models - Join 连线)**：引入 `React-Flow`，实现两张物理表的画布拖拽连线（模拟 A.id = B.id 的 JOIN 关系 JSON 生成）。
- [ ] **防护阻断落地 (一)**：在数据实验室预览数据时，强制注入服务端分页（Offset/Limit），防范首次全量拉取导致的内存重压。

---

## 🚩 Milestone 3: 分析应用与 BI 工作台 (Workbooks & Dashboards)
**目标**：攻克本项目前端最复杂的交互核心——多页面级别的图表渲染、网格拖拽与跨图表联动。

- [ ] **分析应用容器 (/workbooks)**：实现 Workbook 的卡片列表与模板工厂实例化 UI。
- [ ] **无缝对接原生能力 (Page Tabs)**：利用脚手架首屈一指的 **`ProTabs` 与 `KeepAlive`** 机制，零成本实现 Workbook 内部的多 Sheet 页签“无损切换”与图表视图缓存。
- [ ] **自由拖拽网格 (React-Grid-Layout)**：集成响应式拖拽网格，并将布局的 X/Y 坐标数据接入 `useWorkbookStore` 序列化保存。
- [ ] **图表渲染器分发中心**：
  - 封装 **ECharts** 组件（承接折线、柱状、饼图等常规趋势类查询）。
  - 封装 **AntV S2** 组件（承接涉及 3 个以上维度的百万级交叉透视表渲染）。
- [ ] **全局筛选与联动 (Cross-filtering)**：
  - 实现 `useFilterStore`，捕捉开启联动属性图表的 `onClick` 事件。
  - 受控图表订阅 Filter Store，通过状态驱动实现级联重绘而无需刷新整个 Tab。
- [ ] **防护阻断落地 (二)**：开发顶部常驻的 **“Active Filters Bar (生效筛选条)”**，支持双向绑定 URL Query (`?f=...`) 以及一键清除，避免分析师状态迷失。

---

## 🚩 Milestone 4: 自动化流水线引擎 (Data Pipeline Recipes)
**目标**：让用户无需写 SQL 即可清洗数据，提供可视化节点编排与硬核的防盲测沙盒预览功能。

- [ ] **配方中心 (/recipes)**：开发任务列表、执行日志展示面板。
- [ ] **算子编排画布 (Recipe Editor)**：深入定制 `React-Flow`，实现业务算子的 DAG（有向无环图）拖拽连线。
- [ ] **官方算子配置面板**：表单化渲染（去重、类型映射、脱敏、基础聚合等）算子的参数配置。
- [ ] **极客编辑器面板**：集成 `Monaco Editor`，为 Python 沙箱节点提供高亮代码编辑底座，并在 UI 显著位置透传 CPU/Mem/Timeout 等配额硬约束声明。
- [ ] **防护阻断落地 (三) - 沙盒预览 (Dry-run)**：在编辑器底部打通数据预览区。用户调整特定算子参数时，实时拉取 1000 行 Staging 前端切片数据，展示该算子执行前/后的数据 Diff 变化结构。

---

## 🚩 Milestone 5: 风控阻断与极致体验优化 (Security Guards & UX Polish)
**目标**：查漏补缺，将 V1 架构规范中定义的所有硬安全和防雪崩防线彻底封死，达成工业级软件交互体验。

- [ ] **高危操作二次验证拦截 UI (Step-up Auth)**：全局请求层检测到 403 + Step-up 拦截时，触发全局级 TOTP/密码确认模态框，验证机制与底座鉴权无缝融合。
- [ ] **防护阻断落地 (四) - 内存假死防御**：在 Zustand 全局设定极限行数熔断值（如 `MAX_ROWS = 10000`）。若 S2 透视表接收数据超限，强制截断并渲染全屏警告遮罩层：“数据量超限可能导致浏览器崩溃，请增加前置筛选条件”。
- [ ] **防护阻断落地 (五) - 大表 JOIN 雪崩预警**：在视图构建器 (`/models`) 检测到拖拽大规模多表关联时，弹出阻断级提示，引导开启 Cube.js Pre-aggregations（后台预聚合）。
- [ ] **异步加载体验升级**：全面铺开 React 18 `Suspense` 与骨架屏 (Skeleton)，优化组件加载时的视觉抖动。接入 Error Boundary 兜底图表挂掉的渲染区域而不影响全盘。
- [ ] **权限菜单裁切**：完善 `<Can />` 级联鉴权组件，动态读取 Directus 签发的 RBAC 动作树，剔除越权控件。