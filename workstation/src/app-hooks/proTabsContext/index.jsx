import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { createHomeTabKey, normalizePath } from '@src/utils/tabScope'

const defaultValue = {
  scopeKey: 'main',
  scopeHomePath: '/',
  homeTabKey: createHomeTabKey('main'),
  switchScope: () => {},
  activeKey: '',
  setActiveKey: () => {},
  panes: [],
  setPanes: () => {},
  removeTab: () => {},
}

const DEFAULT_SCOPE_KEY = 'main'
const DEFAULT_SCOPE_HOME = '/'

const isSamePanes = (a = [], b = []) => {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i += 1) {
    const prev = a[i]
    const next = b[i]
    if (!prev || !next) return false
    if (prev.key !== next.key) return false
    if (prev.path !== next.path) return false
    if (prev.title !== next.title) return false
    if (prev.i18nKey !== next.i18nKey) return false
    if (prev.closable !== next.closable) return false
    if (prev.content !== next.content) return false
  }

  return true
}

const buildHomePane = (scopeKey, homePath, prevHomePane, nextHomePane) => {
  const homeTabKey = createHomeTabKey(scopeKey)
  const normalizedHome = normalizePath(homePath || nextHomePane?.path || prevHomePane?.path || DEFAULT_SCOPE_HOME)

  return {
    title: nextHomePane?.title ?? prevHomePane?.title ?? 'Home',
    i18nKey: nextHomePane?.i18nKey ?? prevHomePane?.i18nKey,
    content: nextHomePane?.content ?? prevHomePane?.content ?? null,
    key: homeTabKey,
    closable: false,
    path: normalizedHome,
  }
}

const ensureScopeState = (allStates, scopeKey, homePath, incomingHomePane = null) => {
  const normalizedScopeKey = scopeKey || DEFAULT_SCOPE_KEY
  const existing = allStates?.[normalizedScopeKey]
  const normalizedHome = normalizePath(homePath || incomingHomePane?.path || existing?.homePath || DEFAULT_SCOPE_HOME)
  const homeTabKey = createHomeTabKey(normalizedScopeKey)
  const homePane = buildHomePane(normalizedScopeKey, normalizedHome, existing?.homePane, incomingHomePane)
  const existingPanes = Array.isArray(existing?.panes) ? existing.panes : []
  const panesWithoutHome = existingPanes.filter((pane) => pane && pane.key !== homeTabKey)
  const panes = [homePane, ...panesWithoutHome]
  const activeKey = panes.some((pane) => pane.key === existing?.activeKey) ? existing.activeKey : homeTabKey

  return {
    panes,
    activeKey,
    homePath: normalizedHome,
    homeTabKey,
    homePane,
  }
}

const ProTabContext = createContext(defaultValue)
const useProTabContext = () => {
  const context = useContext(ProTabContext)
  if (context == undefined) {
    throw new Error('useValue must be used within a ValueProvider')
  }
  return context
}

const ProTabProvider = ({ children }) => {
  const [scopeKey, setScopeKey] = useState(DEFAULT_SCOPE_KEY)
  const [scopeStates, setScopeStates] = useState({})
  const { redirectTo } = useSafeNavigate()

  const currentScopeState = useMemo(
    () => ensureScopeState(scopeStates, scopeKey, scopeStates?.[scopeKey]?.homePath || DEFAULT_SCOPE_HOME),
    [scopeStates, scopeKey]
  )

  const switchScope = useCallback((nextScopeKey, nextHomePath, nextHomePane) => {
    const normalizedScopeKey = nextScopeKey || DEFAULT_SCOPE_KEY
    const normalizedHome = normalizePath(nextHomePath || DEFAULT_SCOPE_HOME)

    setScopeKey((prev) => (prev === normalizedScopeKey ? prev : normalizedScopeKey))
    setScopeStates((prev) => {
      const ensured = ensureScopeState(prev, normalizedScopeKey, normalizedHome, nextHomePane)
      const existing = prev?.[normalizedScopeKey]
      if (
        existing &&
        existing.homePath === ensured.homePath &&
        existing.activeKey === ensured.activeKey &&
        isSamePanes(existing.panes, ensured.panes)
      ) {
        return prev
      }
      return {
        ...prev,
        [normalizedScopeKey]: ensured,
      }
    })
  }, [])

  const setScopedPanes = useCallback(
    (updater) => {
      setScopeStates((prev) => {
        const ensured = ensureScopeState(prev, scopeKey, prev?.[scopeKey]?.homePath || DEFAULT_SCOPE_HOME)
        const nextPanesRaw = typeof updater === 'function' ? updater(ensured.panes) : updater
        if (!Array.isArray(nextPanesRaw)) return prev

        const homePane = {
          ...ensured.homePane,
          key: ensured.homeTabKey,
          path: ensured.homePath,
          closable: false,
        }
        const nextPanes = [homePane, ...nextPanesRaw.filter((pane) => pane && pane.key !== ensured.homeTabKey)]
        const nextActiveKey = nextPanes.some((pane) => pane.key === ensured.activeKey)
          ? ensured.activeKey
          : ensured.homeTabKey
        const nextState = {
          ...ensured,
          panes: nextPanes,
          activeKey: nextActiveKey,
          homePane,
        }

        const existing = prev?.[scopeKey]
        if (
          existing &&
          existing.homePath === nextState.homePath &&
          existing.activeKey === nextState.activeKey &&
          isSamePanes(existing.panes, nextState.panes)
        ) {
          return prev
        }

        return {
          ...prev,
          [scopeKey]: nextState,
        }
      })
    },
    [scopeKey]
  )

  const setScopedActiveKey = useCallback(
    (updater) => {
      setScopeStates((prev) => {
        const ensured = ensureScopeState(prev, scopeKey, prev?.[scopeKey]?.homePath || DEFAULT_SCOPE_HOME)
        const nextKey = typeof updater === 'function' ? updater(ensured.activeKey) : updater

        if (!nextKey || nextKey === ensured.activeKey) return prev
        if (!ensured.panes.some((pane) => pane.key === nextKey)) return prev

        return {
          ...prev,
          [scopeKey]: {
            ...ensured,
            activeKey: nextKey,
          },
        }
      })
    },
    [scopeKey]
  )

  const removeTab = useCallback(
    (targetKey, callbackFun = () => {}) => {
      let nextPath = ''

      setScopeStates((prev) => {
        const ensured = ensureScopeState(prev, scopeKey, prev?.[scopeKey]?.homePath || DEFAULT_SCOPE_HOME)
        if (!targetKey || targetKey === ensured.homeTabKey) {
          return prev
        }

        const delIndex = ensured.panes.findIndex((item) => item.key === targetKey)
        if (delIndex < 0) return prev

        const filteredPanes = ensured.panes.filter((pane) => pane.key !== targetKey)
        let nextActiveKey = ensured.activeKey

        if (targetKey === ensured.activeKey) {
          const fallbackPane = filteredPanes[Math.max(delIndex - 1, 0)] || filteredPanes[0]
          nextActiveKey = fallbackPane?.key || ensured.homeTabKey
          nextPath = fallbackPane?.path || ensured.homePath
        }

        return {
          ...prev,
          [scopeKey]: {
            ...ensured,
            panes: filteredPanes,
            activeKey: nextActiveKey,
          },
        }
      })

      if (nextPath) {
        redirectTo(nextPath)
      }
      callbackFun()
    },
    [scopeKey, redirectTo]
  )

  const providerValue = useMemo(
    () => ({
      scopeKey,
      scopeHomePath: currentScopeState.homePath,
      homeTabKey: currentScopeState.homeTabKey,
      switchScope,
      activeKey: currentScopeState.activeKey,
      setActiveKey: setScopedActiveKey,
      panes: currentScopeState.panes,
      setPanes: setScopedPanes,
      removeTab,
    }),
    [scopeKey, currentScopeState, switchScope, setScopedActiveKey, setScopedPanes, removeTab]
  )

  return <ProTabContext.Provider value={providerValue}>{children}</ProTabContext.Provider>
}

ProTabProvider.propTypes = {
  children: PropTypes.node,
}

export { ProTabProvider, useProTabContext }
