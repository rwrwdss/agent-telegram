import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'telegramUsername',
    defaultColumns: ['telegramUsername', 'telegramId', 'status', 'source', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('leads')],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'telegramUsername', type: 'text' },
    { name: 'telegramId', type: 'number' },
    { name: 'source', type: 'text' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Converted', value: 'converted' },
        { label: 'Closed', value: 'closed' },
      ],
    },
    { name: 'customFields', type: 'json', defaultValue: {} },
    { name: 'runtimeId', type: 'text', admin: { readOnly: true } },
  ],
}
