const slotState = {
  visualizationRenderers: [],
  visualizationActions: [],
}

function upsertByKey(list, item, key) {
  const index = list.findIndex((current) => current[key] === item[key])
  if (index === -1) {
    list.push(item)
    return
  }
  list[index] = item
}

export function resetSlotRegistry() {
  slotState.visualizationRenderers = []
  slotState.visualizationActions = []
}

export function registerVisualizationRenderer(renderer) {
  if (!renderer || !renderer.type) return
  upsertByKey(slotState.visualizationRenderers, renderer, 'type')
}

export function registerVisualizationAction(action) {
  if (!action || !action.id) return
  upsertByKey(slotState.visualizationActions, action, 'id')
}

export function getVisualizationRenderers() {
  return [...slotState.visualizationRenderers]
}

export function getVisualizationRendererByType(type) {
  return slotState.visualizationRenderers.find((item) => item.type === type) ?? null
}

export function getVisualizationActions() {
  return [...slotState.visualizationActions]
}
