import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

export const TelegramAccounts: CollectionConfig = {
  slug: 'telegram-accounts',
  labels: {
    singular: 'Telegram-номер',
    plural: 'Telegram-номера',
  },
  admin: {
    useAsTitle: 'phone',
    group: 'Работа',
    description: 'Обычные номера Telegram, от которых помощники пишут клиентам.',
    defaultColumns: ['phone', 'status', 'warmupStage', 'dailyLimit', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('telegram-accounts')],
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
      name: 'phone',
      type: 'text',
      required: true,
      label: 'Номер телефона',
      admin: { description: 'В формате +79001234567' },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Состояние',
      defaultValue: 'pending',
      options: [
        { label: 'Не подключён', value: 'pending' },
        { label: 'Прогрев (мягкий старт)', value: 'warmup' },
        { label: 'Работает', value: 'active' },
        { label: 'Ограничен Telegram', value: 'limited' },
        { label: 'Заблокирован', value: 'banned' },
      ],
    },
    {
      name: 'dailyLimit',
      type: 'number',
      label: 'Лимит сообщений в день',
      defaultValue: 5,
      admin: { description: 'Сколько исходящих сообщений можно отправить за сутки' },
    },
    {
      name: 'sentToday',
      type: 'number',
      label: 'Отправлено сегодня',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'warmupStage',
      type: 'number',
      label: 'Этап прогрева',
      defaultValue: 0,
      admin: {
        description: 'Новые номера начинают с малого лимита, чтобы Telegram не заблокировал',
      },
    },
    {
      name: 'runtimeId',
      type: 'text',
      label: 'Технический ID',
      admin: {
        readOnly: true,
        description: 'Служебное поле — понадобится при подключении номера',
      },
    },
    {
      name: 'hasSession',
      type: 'checkbox',
      label: 'Номер подключён',
      defaultValue: false,
      admin: { readOnly: true },
    },
  ],
}
