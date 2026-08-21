import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

export const TelegramAccounts: CollectionConfig = {
  slug: 'telegram-accounts',
  admin: {
    useAsTitle: 'phone',
    defaultColumns: ['phone', 'status', 'warmupStage', 'dailyLimit', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('telegram-accounts')],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'phone', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Warmup', value: 'warmup' },
        { label: 'Active', value: 'active' },
        { label: 'Limited', value: 'limited' },
        { label: 'Banned', value: 'banned' },
      ],
    },
    { name: 'dailyLimit', type: 'number', defaultValue: 5 },
    { name: 'sentToday', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'warmupStage', type: 'number', defaultValue: 0 },
    {
      name: 'runtimeId',
      type: 'text',
      admin: { readOnly: true, description: 'UUID in FastAPI DB after sync' },
    },
    {
      name: 'hasSession',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true },
    },
  ],
}
