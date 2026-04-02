# Veloxis Plugins Workspace

本目录用于承载 Veloxis 官方插件和受控定制插件的源码与工件脚手架。

当前阶段目标不是开放第三方市场，而是：

1. 固化插件目录规范
2. 为官方插件提供统一开发入口
3. 为后续受控定制插件预留结构

## 一、目录约定

```text
plugins/
├── README.md
├── official/
│   ├── ai/
│   ├── datasource/
│   ├── operator/
│   └── visualization/
└── custom/
    └── .gitkeep
```

说明：

- `official/`：平台团队维护的官方插件
- `custom/`：受控定制插件预留区，当前不放真实业务代码

## 二、插件路径规范

推荐路径格式：

```text
plugins/<level>/<type>/<plugin-name>/
```

示例：

```text
plugins/official/visualization/hello-chart/
plugins/official/ai/trusted-copilot/
plugins/official/operator/geo-normalizer/
```

## 三、单个插件目录结构

推荐最小结构：

```text
<plugin>/
├── README.md
├── plugin.json
├── package.json
├── schemas/
│   └── *.json
└── src/
    ├── ui.ts
    ├── worker.ts
    └── index.ts
```

并非所有插件都需要 `ui.ts` 和 `worker.ts` 同时存在，具体以 `plugin.json` 的 `runtime` 与 `entry` 为准。

## 四、核心文件职责

### 1. `plugin.json`

插件 manifest，必须遵循：
[PLUGIN_MANIFEST_SPEC.md](/www/CodeSpace/Veloxis/docs/PLUGIN_MANIFEST_SPEC.md)

### 2. `README.md`

记录插件用途、挂载点、权限申请、配置说明和开发方式。

### 3. `package.json`

定义插件本地开发脚手架和构建入口。当前阶段可保持轻量，不要求立刻接入统一构建系统。

### 4. `schemas/*.json`

定义配置 schema，供注册中心、控制面和 UI 配置面板校验使用。

### 5. `src/*`

插件源码目录。按运行时拆分为：

- `ui.ts`
- `worker.ts`
- `query.ts`

## 五、命名规则

### 目录名

- 使用 kebab-case
- 要表达业务意图，不要使用模糊名

推荐：

- `hello-chart`
- `trusted-copilot`
- `geo-normalizer`

不推荐：

- `plugin1`
- `test`
- `new-plugin`

### 插件 ID

推荐使用反向域名风格：

```json
"id": "veloxis.plugin.visualization.hello-chart"
```

## 六、开发约束

1. 插件不得绕过宿主权限模型。
2. 插件不得直接假定拥有底层 Doris 或宿主私有实现访问权。
3. 插件必须通过标准 slot / hook / event 接入系统。
4. 插件需要显式声明申请权限，不能使用通配能力。
5. 当前阶段仅接受官方插件和受控定制插件，不接受开放式第三方插件。

## 七、当前样例

首个官方样例位于：

```text
plugins/official/visualization/hello-chart/
```

该样例用于验证：

1. Visualization 插件目录结构
2. `plugin.json` manifest 规范
3. `workbook.chart.renderer` 和 `workbook.chart.action` 的双挂载模型
4. UI-only 插件的最小脚手架

## 八、后续扩展

后续如插件体系正式进入实现阶段，建议继续补齐：

1. 统一插件构建脚本
2. 插件本地调试命令
3. 插件打包输出目录规范
4. 插件签名与校验工具
5. 官方样例插件集合

