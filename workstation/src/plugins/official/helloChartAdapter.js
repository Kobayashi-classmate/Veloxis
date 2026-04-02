const HELLO_PLUGIN_ID = 'veloxis.plugin.visualization.hello-chart'

const HELLO_CHART_OPTION = {
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'line',
      smooth: true,
      data: [120, 200, 150, 80, 70, 110, 130],
      areaStyle: { opacity: 0.15 },
    },
  ],
}

export const helloChartAdapter = {
  pluginId: HELLO_PLUGIN_ID,
  register(manifest) {
    const slots = Array.isArray(manifest?.slots) ? manifest.slots : []
    const output = {
      renderers: [],
      actions: [],
    }

    if (slots.includes('workbook.chart.renderer')) {
      output.renderers.push({
        type: 'hello-chart',
        label: manifest?.metadata?.displayName || 'Hello Chart',
        icon: '✨',
        group: '插件',
        defaultOption: HELLO_CHART_OPTION,
        sourcePluginId: HELLO_PLUGIN_ID,
      })
    }

    if (slots.includes('workbook.chart.action')) {
      output.actions.push({
        id: 'hello-chart.inspect',
        label: 'Inspect Hello Chart',
        sourcePluginId: HELLO_PLUGIN_ID,
        matchChartType: 'hello-chart',
      })
    }

    return output
  },
}

export function getOfficialVisualizationAdapters() {
  return [helloChartAdapter]
}
