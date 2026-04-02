type HelloChartConfig = {
  title?: string
  palette?: 'default' | 'ocean' | 'sunset'
  showLegend?: boolean
}

type RendererRegistration = {
  type: string
  label: string
  render: (config?: HelloChartConfig) => {
    component: string
    config: HelloChartConfig
  }
}

type ActionRegistration = {
  id: string
  label: string
  run: (chartId: string) => {
    chartId: string
    message: string
  }
}

export const helloChartPlugin = {
  id: 'veloxis.plugin.visualization.hello-chart',
  slots: ['workbook.chart.renderer', 'workbook.chart.action'],
  register(): {
    renderer: RendererRegistration
    action: ActionRegistration
  } {
    return {
      renderer: {
        type: 'hello-chart',
        label: 'Hello Chart',
        render(config = {}) {
          return {
            // Placeholder return shape for the future UI Plugin Host.
            component: 'HelloChartRenderer',
            config: {
              title: config.title ?? 'Hello Chart',
              palette: config.palette ?? 'default',
              showLegend: config.showLegend ?? true,
            },
          }
        },
      },
      action: {
        id: 'hello-chart.inspect',
        label: 'Inspect Hello Chart',
        run(chartId: string) {
          return {
            chartId,
            message: 'Hello Chart action invoked',
          }
        },
      },
    }
  },
}
