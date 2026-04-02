const UUID_WITH_DASH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_COMPACT_RE = /^[0-9a-f]{32}$/i

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

export const isUuidLike = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return false
  return UUID_WITH_DASH_RE.test(normalized) || UUID_COMPACT_RE.test(normalized)
}

export const resolveUserDisplayName = (user, unnamedLabel = '未命名用户') => {
  const name = normalizeText(user?.name)
  if (name && !isUuidLike(name)) {
    return name
  }

  const email = normalizeText(user?.email)
  if (email) {
    return email
  }

  const login = normalizeText(user?.login)
  if (login && !isUuidLike(login)) {
    return login
  }

  return unnamedLabel
}

