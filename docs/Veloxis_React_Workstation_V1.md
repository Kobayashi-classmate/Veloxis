# Veloxis React Workstation 架构与规范 V1

本文档定义了 Veloxis 数据分析平台终端界面（React Workstation）的信息架构、路由拓扑、核心业务逻辑以及视觉规范。该架构旨在支撑 500+ 高并发交互，并规避前端性能与逻辑盲区。

> **🏗️ 核心架构策略：V1 双入口模式与基座选型**
> *   **双入口分离**：V1 采用严格的前后台分离（双入口）策略。**后台管理**（用户/角色/环境/插件大盘）统一走内置的 Directus Vue Admin（由网关动态前缀保护）；**前台业务**（图表分析、数据清洗）统一走本 React Workstation。两者通过 Token 跨域互信，确保管控面与业务面的绝对隔离。
> *   **基座选型**：前端工程基于企业级中后台脚手架 **`wkylin/pro-react-admin`** 构建。深度继承其 React 19 + Vite 7 特性、原生的 KeepAlive 缓存、多标签页（Tabs）和动态权限路由能力，并在此基础上进行符合 BI 场景的外科手术式改造。

---

## 🎨 一、 视觉主题规范 (The "Deep Data" Palette)

为了匹配“重型分析、极速响应、工业级合规”的定位，Veloxis V1 采用专属的 **"Deep Data"** 主题，深入覆盖基座原有的默认 AntD 蓝主题。该主题以深空邃蓝深蓝为主轴，辅以警告与成功色，确保数据高对比度和长时间护眼：

1.  **🔵 主视觉色 (Primary / Brand)**: `#1E3A8A` (Deep Sapphire)
    *   *用途*: 顶层导航栏背景、核心动作按钮、选中的侧边栏状态。代表稳定、信任。
2.  **🌌 视觉底色/白底辅助 (Background / Neutral)**: `#F3F4F6` (Ghost Gray)
    *   *用途*: 画布背景、卡片底层。极其微弱的灰色，让白色的图表卡片产生层次感，不刺眼。
3.  **🔲 数据墨色 (Data Ink / Text Primary)**: `#111827` (Abyss Black)
    *   *用途*: 一级标题、核心数据大字、X/Y 轴标签。高对比度易读。
4.  **🟢 交互洞察色 (Highlight / Success)**: `#10B981` (Emerald Green)
    *   *用途*: “执行成功”提示、图表中的高亮选中态、正向增长趋势（YoY/MoM）。
5.  **🟠 警报与阻断色 (Warning / Critical)**: `#F59E0B` (Amber) & `#EF4444` (Crimson)
    *   *用途*: 队列执行报错、数据异常点标记、删除高危操作（Step-up 二次确认按钮）。

*(开发建议：在 Tailwind CSS 和 pro-react-admin 的内置 AntD Theme ConfigProvider 中将其注册为核心 Design Token)*

---

## 🗺️ 二、 顶层路由与信息架构 (Routing Topology)

结合 `pro-react-admin` 本身的动态路由机制，系统采用“全局层 -> 项目层 -> 业务应用层”的嵌套结构，并在项目层启用 **KeepAlive** 和 **多 Tabs**，保证跨页面分析不丢失现场。

```text
/login                          # 🔑 统一安全门禁 /login
  ├── 账密输入 / SSO / TOTP 动态码验证
  └── [逻辑拦截] 未登录或 Token 过期一律重定向至此

/global-console                 # 🌍 登录后首屏：全局控制台 (Global Dashboard)
  ├── 概览区：当前日期、系统运行状态、版本通告
  ├── 效率区：最近访问的分析应用 (Recent Workbooks) 足迹直达
  ├── 实用区：个人便签/Todo 备忘录组件 (LocalStorage + 远端同步)
  ├── 监控区：异常监控预警灯 (透传项目内执行失败或超额告警)
  └── 入口区：切换/搜索进入具体项目 (Project Selector)

/workspaces                     # 🏢 多项目大厅 (Project Hub)
  ├── 视图过滤：基于 Directus RBAC 权限体系，仅展示有权访问的 Project
  └── 项目卡片列表：展示描述、成员数、最后活跃时间

/project/:projectId             # 💼 进入具体项目的工作空间 (项目上下文主干)
  │
  │   [全局防遗忘护栏]: 顶部常驻“全局筛选器状态栏 (Active Filters Bar)”
  │                    并双向绑定到 URL Query (如 ?region=east)
  │
  ├── /workbooks                # 📊 分析应用中心 (多页面模块化核心)
  │    ├── 列表视图：应用卡片 (支持分组、打标)
  │    ├── 模板工厂：从全局市场实例化带有标准排版的 Workbook (需重绑数据)
  │    └── /:workbookId
  │         ├── 顶层事件总线：处理 Page 内的“图表级联联动 (Cross-filtering)”
  │         ├── 多页签分析界面 (利用脚手架原生的 ProTabs 切换概览/钻取页)
  │         └── /page/:pageId   # 具体看板页面 (React-Grid-Layout)
  │              ├── 渲染器分发：走 Cube.js 查询 -> 趋势分类走 ECharts -> 交叉分析走 AntV S2
  │              ├── [防崩溃熔断 ⚠️]: S2 表格组件强制注入服务端 Offset/Limit 分页
  │              └── [高负荷阻断 ⚠️]: 前端设定 MAX_ROWS，超出强制截断并弹窗警告
  │
  ├── /models                   # 🗄️ 语义与融合层 (Data Modeling)
  │    ├── 数据集列表：展示导入物理表与 Dataset_Versions
  │    ├── 视图构建器：基于 React-Flow 拖拽连线配置 JOIN 关系，动态生成 Cube Schema
  │    ├── [风控提示 ⚠️]: 大表 JOIN 强制弹窗建议开启 Cube.js Pre-aggregations
  │    └── 数据实验室：基于 Cube.js 的分页极速探查
  │
  └── /recipes                  # ⚙️ 自动化配方队列 (Data Pipeline)
       ├── 配方列表与执行追踪
       └── /editor/:recipeId
            ├── 左侧：工具箱 (官方算子库 + Python 沙箱)
            ├── 中间：画布流程图 (算子执行的 DAG 节点)
            ├── 底部：[沙盒预览 (Dry-run) ⚠️] 抓取前 1000 行模拟执行展示数据变化
            └── [配额约束 ⚠️] Python 节点面板透传 CPU/Mem/Timeout 限制声明
```

*(注意：原项目的 `setting` 由 Directus Vue Admin 承担，React 端仅展示当前项目中与分析业务强相关的简单字典查看。)*

---

## 🧠 三、 前端核心业务逻辑架构 (State & Network)

### 1. 状态管理矩阵 (Redux + Zustand 融合驱动)
为了在享受开源脚手架基建优势的同时，解决图表联动带来的性能瓶颈，我们采用**“红蓝兼修”**的策略：

*   **🟥 基于 Redux 的核心骨架（沿用脚手架能力）**
    *   **应用级稳定状态**：涵盖路由权限表自动生成、多标签页 (`ProTabs`) 管理、`KeepAlive` 高速缓存状态、暗黑/明亮主题偏好及国际化设定。这一层保证了中台骨架的坚固。
*   **🟦 基于 Zustand 的高频业务状态（新建切割）**
    *   **`useProjectStore`**: 路由切入 `/project/:id` 时触发加载。缓存当前项目的环境变量、可用数据字典。
    *   **`useWorkbookStore`**: 管理当前打开的 Workbook 配置树（Pages及 Layout 坐标），处理 `React-Grid-Layout` 高频拖拽保存的主力。
    *   **`useFilterStore` (联动核心)**: 扁平的 Key-Value 字典。负责侦听开启联动属性的图表 `onClick` 事件（写入条件），通知受控组件触发 Cube.js Query 重绘。将其剥离出 Redux 可最大限度避免牵一发而动全身的全局重渲染。

### 2. 通信与拦截层 (整合脚手架网络层 + Cube.js Client)
*   **元数据/CRUD通信 (复用封装好的 Axios)**：
    *   利用脚手架已内置的“并发/串行/重试/取消/全局错误处理”健壮请求层。
    *   请求拦截：自动挂载 `Authorization: Bearer <Token>` 与 `X-Project-Id: <ID>`。
    *   响应拦截：全局捕获 `401/403`。遇到核心风控拦截时（如配置要求二次确认的高危操作），挂起请求 -> 弹出 TOTP Step-up 弹窗 -> 验证成功后补发原始请求。
*   **分析数据/长耗时流 (SWR / React Suspense)**：
    *   对接 `@cubejs-client/react`，利用其内置 WebSocket/长轮询机制。
    *   配合 React Suspense 实现图表优雅加载（Skeleton 骨架屏）。
    *   配合 Error Boundary 兜底展现友好错误页，避免单一 API 超时或内存挂掉导致系统白屏。

---

## 🛡️ 四、 开发注意事项与交互阻断项 (Must-Have Guards)

在 V1 版本的开发中，前端团队**必须**实现以下四个交互阻断防线，这是系统的护城河：

1.  **前端内存假死防御（防崩溃熔断）**
    *   **问题**: Cube.js 若返回单次 10万+ 行 JSON 数据，会导致浏览器主线程长期挂起。
    *   **对策**: 交叉分析透视表（S2）**严禁拉取全量明细**。必须实施**服务端分页（Offset/Limit）**。并配置最大行数阈值（如 `MAX_ROWS = 10000`），强制前端截断并弹窗：“数据量过大，请增加筛选条件”。
2.  **全局过滤器的“状态迷失”拯救**
    *   **问题**: 用户跨 Page/Tab 浏览时忘记当前生效的过滤条件。
    *   **对策**: 在项目工作空间顶部常驻 **“Active Filters Bar”**。过滤状态需同步至 URL Query（`?f=...`），以便复制链接分享时状态不丢。
3.  **大表 JOIN 的雪崩预警**
    *   **问题**: 业务人员在 `/models` 中随意配置大表格互相关联，压垮底层 Doris。
    *   **对策**: 前端检测到复杂多表连线生成 Cube Schema 时，弹出**强制提醒**，建议用户勾选开启“Cube.js Pre-aggregations (后台预聚合)”。
4.  **自动化队列的闭环调试（沙盒预览）**
    *   **问题**: Data Worker 执行 Recipe 是黑盒，调测极不友好。
    *   **对策**: 在 Recipe Editor 底部提供 **Dry-run Sandbox**。加载原始 Staging 表前 1000 行，前端利用模拟接口即刻反映算子执行前/后的数据 Diff 结构（What-you-see-is-what-you-get）。