# Hello Chart

`Hello Chart` 是 Veloxis 的首个官方 Visualization 插件样例，用于验证插件目录规范、manifest 契约和可视化插件挂载模型。

## 一、目标

该插件不是生产级图表实现，而是最小样例脚手架，用于验证：

1. `plugin.json` 是否符合规范
2. `workbook.chart.renderer` 是否可注册新图表类型
3. `workbook.chart.action` 是否可提供图表级动作入口
4. UI-only 插件如何组织源码与配置

## 二、插件信息

- 类型：`visualization`
- 级别：`official-optional`
- 运行时：`ui`
- 插件 ID：`veloxis.plugin.visualization.hello-chart`

## 三、挂载点

- `workbook.chart.renderer`
- `workbook.chart.action`

## 四、申请权限

- `project:read`
- `workbook:write`

## 五、目录结构

```text
hello-chart/
├── README.md
├── plugin.json
├── package.json
├── schemas/
│   └── chart-config.schema.json
└── src/
    ├── index.ts
    └── ui.ts
```

## 六、当前状态

当前仅提供脚手架，不直接接入现有运行时。后续插件系统落地时，应由 UI Plugin Host 读取 `plugin.json` 并加载 `entry.ui`。

