import type { Access } from 'payload'

export const tenantAccess: {
  read: Access
  create: Access
  update: Access
  delete: Access
} = {
  read: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    if (!user.tenant) return false
    return { tenant: { equals: user.tenant } }
  },
  create: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    return Boolean(user.tenant && user.role !== 'operator')
  },
  update: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    if (!user.tenant) return false
    if (user.role === 'operator') {
      // operators can update leads status via UI flows; keep collection update limited
      return false
    }
    return { tenant: { equals: user.tenant } }
  },
  delete: ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    if (!user.tenant || user.role === 'operator') return false
    return { tenant: { equals: user.tenant } }
  },
}
