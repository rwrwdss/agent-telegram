import type { CollectionConfig } from 'payload'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      return { id: { equals: user.tenant } }
    },
    create: ({ req: { user } }) => Boolean(user && user.role === 'superadmin'),
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'superadmin') return true
      return { id: { equals: user.tenant } }
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
          await fetch(`${API_URL}/sync`, {
            method: 'POST',
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
        } catch (e) {
          req.payload.logger.error(`Tenant sync error: ${String(e)}`)
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'plan',
      type: 'select',
      defaultValue: 'starter',
      options: [
        { label: 'Starter', value: 'starter' },
        { label: 'Pro', value: 'pro' },
        { label: 'Enterprise', value: 'enterprise' },
      ],
    },
    {
      name: 'limits',
      type: 'json',
      defaultValue: { maxAgents: 5, maxAccounts: 3 },
    },
  ],
}
