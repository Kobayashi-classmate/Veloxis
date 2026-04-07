import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPluginInstallations } from '@src/service/api/worker'
import { getOfficialVisualizationAdapters } from './official/helloChartAdapter'
import { registerVisualizationAction, registerVisualizationRenderer, resetSlotRegistry } from './slotRegistry'

const UIPluginHostContext = createContext({
  loading: false,
  error: null,
  installations: [],
  registryVersion: 0,
  refresh: async () => {},
})

function resolveVisualizationAdapters() {
  return getOfficialVisualizationAdapters()
}

export const UIPluginHostProvider = ({ projectId, children }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [installations, setInstallations] = useState([])
  const [registryVersion, setRegistryVersion] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getPluginInstallations({
        status: 'enabled',
        type: 'visualization',
        includeManifest: true,
        ...(projectId
          ? {
              effectiveScopeType: 'project',
              effectiveScopeId: projectId,
            }
          : {}),
      })

      resetSlotRegistry()

      const adapters = resolveVisualizationAdapters()
      const adapterMap = new Map(adapters.map((adapter) => [adapter.pluginId, adapter]))

      for (const installation of data) {
        const manifest = installation?.manifest
        const pluginId = manifest?.id || installation?.plugin_id
        if (!pluginId) continue

        const adapter = adapterMap.get(pluginId)
        if (!adapter) continue

        const registrations = adapter.register(manifest, installation)
        for (const renderer of registrations.renderers ?? []) {
          registerVisualizationRenderer(renderer)
        }
        for (const action of registrations.actions ?? []) {
          registerVisualizationAction(action)
        }
      }

      setInstallations(data)
      setRegistryVersion((version) => version + 1)
    } catch (err) {
      console.error('[UIPluginHost] refresh failed:', err)
      setError(err)
      resetSlotRegistry()
      setInstallations([])
      setRegistryVersion((version) => version + 1)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      loading,
      error,
      installations,
      registryVersion,
      refresh,
    }),
    [loading, error, installations, registryVersion, refresh]
  )

  return <UIPluginHostContext.Provider value={value}>{children}</UIPluginHostContext.Provider>
}

export function useUIPluginHost() {
  return useContext(UIPluginHostContext)
}
