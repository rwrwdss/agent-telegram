import type { Access } from 'payload'

type UserLike = {
  id?: number | string
  role?: string
  tenant?: unknown
} | null | undefined

/** Достаём id компании: Payload иногда отдаёт объект, а не число */
export function companyIdOf(user: UserLike): number | string | null {
  if (!user) return null
  const raw = user.tenant
  if (raw == null) return null
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: number | string }).id
    return id ?? null
  }
  if (typeof raw === 'number' || typeof raw === 'string') return raw
  return null
}

export const tenantAccess: {
  read: Access
  create: Access
  update: Access
  delete: Access
} = {
  read: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    const companyId = companyIdOf(user)
    if (companyId == null || Number.isNaN(Number(companyId))) return false
    return { tenant: { equals: companyId } }
  },
  create: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    return Boolean(companyIdOf(user) && user.role !== 'operator')
  },
  update: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    const companyId = companyIdOf(user)
    if (companyId == null || Number.isNaN(Number(companyId))) return false
    if (user.role === 'operator') return false
    return { tenant: { equals: companyId } }
  },
  delete: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    const companyId = companyIdOf(user)
    if (companyId == null || user.role === 'operator') return false
    return { tenant: { equals: companyId } }
  },
}
