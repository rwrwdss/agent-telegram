import type { CollectionConfig } from 'payload'
import { tenantAccess } from '../access/tenant'
import { syncToRuntime } from '../hooks/syncToRuntime'

const defaultSteps = {
  initial: 'start',
  nodes: {
    start: {
      goal: 'Поздороваться и кратко представить предложение',
      instructions: 'Короткое дружелюбное первое сообщение, без спама.',
      allowed_next: ['qualify', 'objection'],
    },
    qualify: {
      goal: 'Понять, что нужно человеку',
      instructions: 'Задай 1-2 уточняющих вопроса.',
      allowed_next: ['offer', 'objection', 'handoff'],
    },
    offer: {
      goal: 'Сделать предложение и предложить следующий шаг',
      allowed_next: ['close', 'objection'],
    },
    objection: {
      goal: 'Ответить на сомнения',
      allowed_next: ['offer', 'handoff', 'close'],
    },
    close: {
      goal: 'Договориться о действии (звонок, оплата, ссылка)',
      allowed_next: [],
    },
    handoff: {
      goal: 'Передать живому сотруднику',
      instructions: 'Если вопрос сложный — needs_human=true',
      allowed_next: [],
    },
  },
}

export const Scripts: CollectionConfig = {
  slug: 'scripts',
  labels: {
    singular: 'Сценарий разговора',
    plural: 'Сценарии разговора',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Работа',
    description: 'Как помощник ведёт беседу: приветствие, вопросы, предложение, закрытие.',
    defaultColumns: ['name', 'version', 'tenant'],
  },
  access: tenantAccess,
  hooks: {
    afterChange: [syncToRuntime('scripts')],
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
      label: 'Название сценария',
      admin: { description: 'Например: «Продажа курса» или «Запись на консультацию»' },
    },
    {
      name: 'version',
      type: 'text',
      required: true,
      defaultValue: '1',
      label: 'Версия',
      admin: { description: 'Меняйте при тестах разных формулировок (1, 2, A, B…)' },
    },
    {
      name: 'systemPrompt',
      type: 'textarea',
      required: true,
      label: 'Характер помощника',
      defaultValue:
        'Ты менеджер по продажам в Telegram. Пиши коротко, по-человечески, без канцелярита.',
      admin: { description: 'Общие правила тона и поведения на весь диалог' },
    },
    {
      name: 'steps',
      type: 'json',
      required: true,
      label: 'Этапы разговора',
      defaultValue: defaultSteps,
      admin: {
        description: 'Пошаговый план: что говорить на каждом этапе и куда переходить дальше',
      },
    },
    {
      name: 'fallbackRules',
      type: 'json',
      label: 'Если что-то пошло не так',
      defaultValue: { onError: 'handoff' },
      admin: { description: 'Обычно: передать диалог живому сотруднику' },
    },
    {
      name: 'runtimeId',
      type: 'text',
      label: 'Технический ID',
      admin: { readOnly: true },
    },
  ],
}
