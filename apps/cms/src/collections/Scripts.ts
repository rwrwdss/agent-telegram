import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

const defaultSteps = {
  initial: 'start',
  nodes: {
    start: {
      goal: 'Поздороваться и кратко представить оффер',
      instructions: 'Короткое дружелюбное первое сообщение, без спама.',
      allowed_next: ['qualify', 'objection'],
    },
    qualify: {
      goal: 'Выяснить потребность лида',
      instructions: 'Задай 1-2 уточняющих вопроса.',
      allowed_next: ['offer', 'objection', 'handoff'],
    },
    offer: {
      goal: 'Сделать предложение и CTA',
      allowed_next: ['close', 'objection'],
    },
    objection: {
      goal: 'Отработать возражение',
      allowed_next: ['offer', 'handoff', 'close'],
    },
    close: {
      goal: 'Закрыть на действие (созвон/оплата/ссылка)',
      allowed_next: [],
    },
    handoff: {
      goal: 'Передать человеку',
      instructions: 'Если вопрос сложный — needs_human=true',
      allowed_next: [],
    },
  },
}

export const Scripts: CollectionConfig = {
  slug: 'scripts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'version', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('scripts')],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'version', type: 'text', required: true, defaultValue: '1' },
    {
      name: 'systemPrompt',
      type: 'textarea',
      required: true,
      defaultValue:
        'Ты менеджер по продажам в Telegram. Пиши коротко, по-человечески, без канцелярита.',
    },
    {
      name: 'steps',
      type: 'json',
      required: true,
      defaultValue: defaultSteps,
    },
    { name: 'fallbackRules', type: 'json', defaultValue: { onError: 'handoff' } },
    { name: 'runtimeId', type: 'text', admin: { readOnly: true } },
  ],
}
