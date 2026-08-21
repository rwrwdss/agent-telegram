import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

export const Agents: CollectionConfig = {
  slug: 'agents',
  labels: {
    singular: 'Помощник',
    plural: 'Помощники',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Работа',
    description: 'Виртуальный менеджер: номер Telegram + сценарий разговора + ИИ.',
    defaultColumns: ['name', 'status', 'llmModel', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('agents')],
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
      name: 'name',
      type: 'text',
      required: true,
      label: 'Имя помощника',
      admin: { description: 'Как вы его назовёте внутри кабинета' },
    },
    {
      name: 'telegramAccount',
      type: 'relationship',
      relationTo: 'telegram-accounts',
      required: true,
      label: 'Telegram-номер',
      admin: { description: 'С какого номера он будет писать' },
    },
    {
      name: 'script',
      type: 'relationship',
      relationTo: 'scripts',
      required: true,
      label: 'Сценарий разговора',
    },
    {
      name: 'llmModel',
      type: 'text',
      label: 'Модель ИИ',
      defaultValue: 'gpt-4o-mini',
      admin: { description: 'Какой ИИ отвечает за тексты сообщений' },
    },
    {
      name: 'temperature',
      type: 'number',
      label: 'Креативность',
      defaultValue: 0.7,
      min: 0,
      max: 2,
      admin: { description: '0 — строже по сценарию, ближе к 1 — свободнее формулировки' },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      defaultValue: 'active',
      options: [
        { label: 'Включён', value: 'active' },
        { label: 'На паузе', value: 'paused' },
      ],
    },
    {
      name: 'runtimeId',
      type: 'text',
      label: 'Технический ID',
      admin: { readOnly: true },
    },
  ],
}
