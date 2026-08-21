import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

export const Agents: CollectionConfig = {
  slug: 'agents',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'llmModel', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('agents')],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    {
      name: 'telegramAccount',
      type: 'relationship',
      relationTo: 'telegram-accounts',
      required: true,
    },
    { name: 'script', type: 'relationship', relationTo: 'scripts', required: true },
    { name: 'llmModel', type: 'text', defaultValue: 'gpt-4o-mini' },
    { name: 'temperature', type: 'number', defaultValue: 0.7, min: 0, max: 2 },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
      ],
    },
    { name: 'runtimeId', type: 'text', admin: { readOnly: true } },
  ],
}
