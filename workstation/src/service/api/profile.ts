import request from '@/service/request'

const PROFILE_FIELDS = 'id,email,first_name,last_name,avatar,organization,organization.id,organization.name'
const UPDATABLE_FIELDS = ['first_name', 'last_name'] as const

export interface MyProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  avatar: string
  organization: string
}

export interface UpdateMyProfilePayload {
  first_name?: string
  last_name?: string
}

const toScopeId = (value: any): string => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  if (typeof value.id === 'string' && value.id.trim()) return value.id.trim()
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim()
  return ''
}

const normalizeProfile = (raw: any): MyProfile => ({
  id: raw?.id ?? '',
  email: raw?.email ?? '',
  first_name: raw?.first_name ?? '',
  last_name: raw?.last_name ?? '',
  avatar: raw?.avatar ?? '',
  organization: toScopeId(raw?.organization),
})

const pickUpdatableFields = (payload: UpdateMyProfilePayload): UpdateMyProfilePayload => {
  const next: UpdateMyProfilePayload = {}

  UPDATABLE_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = payload[key]
      next[key] = typeof value === 'string' ? value.trim() : ''
    }
  })

  return next
}

export const getMyProfile = async (): Promise<MyProfile> => {
  const response = (await request.get('/users/me', { fields: PROFILE_FIELDS })) as any
  const data = response?.data ?? response
  return normalizeProfile(data)
}

export const updateMyProfile = async (payload: UpdateMyProfilePayload): Promise<MyProfile> => {
  const safePayload = pickUpdatableFields(payload)

  if (Object.keys(safePayload).length === 0) {
    throw new Error('No updatable profile fields provided')
  }

  const response = (await request.patch('/users/me', safePayload)) as any
  const data = response?.data ?? response

  // Directus 可能按配置不返回完整对象，兜底再拉取一次最新资料
  if (!data || typeof data !== 'object' || !('id' in data)) {
    return getMyProfile()
  }

  return normalizeProfile(data)
}
