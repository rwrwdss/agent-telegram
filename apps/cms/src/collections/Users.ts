import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      return { tenant: { equals: user.tenant } }
    },
    create: ({ req: { user } }) => Boolean(user && (user.role === 'superadmin' || user.role === 'admin')),
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      return { tenant: { equals: user.tenant } }
    },
    delete: ({ req: { user } }) => Boolean(user && user.role === 'superadmin'),
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Superadmin', value: 'superadmin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Operator', value: 'operator' },
      ],
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      admin: {
        condition: (_, siblingData) => siblingData?.role !== 'superadmin',
      },
    },
  ],
}
