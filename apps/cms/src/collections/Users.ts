import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Сотрудник',
    plural: 'Сотрудники',
  },
  auth: {
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  admin: {
    useAsTitle: 'email',
    group: 'Настройки',
    description: 'Люди, которые заходят в кабинет: владелец, менеджер или оператор.',
    defaultColumns: ['email', 'role', 'tenant', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      return { tenant: { equals: user.tenant } }
    },
    create: async ({ req }) => {
      if (req.user) return req.user.role === 'superadmin' || req.user.role === 'admin'
      // Первый пользователь платформы (пустая база)
      const existing = await req.payload.find({
        collection: 'users',
        limit: 0,
        overrideAccess: true,
      })
      return existing.totalDocs === 0
    },
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
      label: 'Роль',
      defaultValue: 'admin',
      options: [
        { label: 'Владелец платформы', value: 'superadmin' },
        { label: 'Владелец компании', value: 'admin' },
        { label: 'Оператор (отвечает вручную)', value: 'operator' },
      ],
      admin: {
        description: 'Владелец компании настраивает всё. Оператор только ведёт переписку.',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      label: 'Компания',
      required: false,
      admin: {
        condition: (_, siblingData) => siblingData?.role !== 'superadmin',
        description: 'К какой компании относится сотрудник',
      },
    },
  ],
}
