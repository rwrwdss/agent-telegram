import type { CollectionConfig } from 'payload'
import { companyIdOf } from '../access/tenant'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: {
    singular: 'Компания',
    plural: 'Компании',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Настройки',
    description: 'Ваш бизнес-аккаунт. Все сотрудники и переписки принадлежат компании.',
    defaultColumns: ['name', 'plan', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      const companyId = companyIdOf(user)
      if (companyId == null || Number.isNaN(Number(companyId))) return false
      return { id: { equals: companyId } }
    },
    create: ({ req: { user } }) => Boolean(user && user.role === 'superadmin'),
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      const companyId = companyIdOf(user)
      if (companyId == null || Number.isNaN(Number(companyId))) return false
      return { id: { equals: companyId } }
    },
    delete: ({ req: { user } }) => Boolean(user && user.role === 'superadmin'),
  },
  hooks: {
    afterChange: [
      async ({ doc, req, context }) => {
        if (context?.skipSync) return doc
        const API_URL = process.env.API_URL || 'http://localhost:8000'
        const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'dev-service-token-change-me'
        try {
          const ctrl = new AbortController()
          const t = setTimeout(() => ctrl.abort(), 2500)
          await fetch(`${API_URL}/sync`, {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Token': SERVICE_TOKEN,
              'X-Tenant-Id': String(doc.id),
            },
            body: JSON.stringify({
              entity: 'tenants',
              payload_id: String(doc.id),
              data: { id: doc.id, name: doc.name, plan: doc.plan, limits: doc.limits },
            }),
          })
          clearTimeout(t)
        } catch {
          // Движок переписки может быть ещё не поднят — кабинет работает без него
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Название компании',
      admin: { description: 'Как компания будет отображаться в системе' },
    },
    {
      name: 'plan',
      type: 'select',
      label: 'Тариф',
      defaultValue: 'starter',
      options: [
        { label: 'Старт', value: 'starter' },
        { label: 'Бизнес', value: 'pro' },
        { label: 'Крупный бизнес', value: 'enterprise' },
      ],
    },
    {
      name: 'limits',
      type: 'json',
      label: 'Лимиты',
      defaultValue: { maxAgents: 5, maxAccounts: 3 },
      admin: {
        description: 'Ограничения: сколько помощников и Telegram-аккаунтов можно подключить',
      },
    },
  ],
}
