import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: {
    singular: 'Контакт',
    plural: 'Контакты',
  },
  admin: {
    useAsTitle: 'telegramUsername',
    group: 'Работа',
    description: 'Люди, которым помощник пишет в Telegram.',
    defaultColumns: ['telegramUsername', 'telegramId', 'status', 'source', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('leads')],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      label: 'Компания',
    },
    {
      name: 'telegramUsername',
      type: 'text',
      label: 'Ник в Telegram',
      admin: { description: 'Без @, например: ivan_petrov' },
    },
    {
      name: 'telegramId',
      type: 'number',
      label: 'ID в Telegram',
      admin: { description: 'Если известен числовой ID — надёжнее ника' },
    },
    {
      name: 'source',
      type: 'text',
      label: 'Откуда контакт',
      admin: { description: 'Реклама, база, ручной ввод…' },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      defaultValue: 'new',
      options: [
        { label: 'Новый', value: 'new' },
        { label: 'В работе', value: 'in_progress' },
        { label: 'Договорились', value: 'converted' },
        { label: 'Закрыт', value: 'closed' },
      ],
    },
    {
      name: 'customFields',
      type: 'json',
      label: 'Доп. данные',
      defaultValue: {},
      admin: { description: 'Любые поля: город, продукт, комментарий' },
    },
    {
      name: 'runtimeId',
      type: 'text',
      label: 'Технический ID',
      admin: { readOnly: true },
    },
  ],
}
