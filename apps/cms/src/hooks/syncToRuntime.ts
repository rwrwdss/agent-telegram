import type { CollectionAfterChangeHook } from 'payload'

const API_URL = process.env.API_URL || 'http://localhost:8000'
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'dev-service-token-change-me'

function relId(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return String((value as { id: string | number }).id)
  }
  return undefined
}

export function syncToRuntime(entity: string): CollectionAfterChangeHook {
  return async ({ doc, req, context }) => {
    if (context?.skipSync) return doc

    const tenantId = relId(doc.tenant)
    if (!tenantId) return doc

    const data: Record<string, unknown> = {
      tenant_id: tenantId,
      name: doc.name,
      phone: doc.phone,
      status: doc.status,
      daily_limit: doc.dailyLimit,
      warmup_stage: doc.warmupStage,
      version: doc.version,
      system_prompt: doc.systemPrompt,
      steps_json: doc.steps,
      fallback_rules: doc.fallbackRules,
      llm_model: doc.llmModel,
      temperature: doc.temperature,
      telegram_account_id: relId(doc.telegramAccount),
      script_id: relId(doc.script),
      telegram_username: doc.telegramUsername,
      telegram_id: doc.telegramId,
      source: doc.source,
      custom_fields_json: doc.customFields,
    }

    try {
      const res = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': SERVICE_TOKEN,
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          entity,
          payload_id: String(doc.id),
          data,
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as { id?: string }
        if (json.id && json.id !== doc.runtimeId) {
          await req.payload.update({
            collection: entity as 'leads',
            id: doc.id,
            data: { runtimeId: json.id },
            depth: 0,
            overrideAccess: true,
            context: { skipSync: true },
          })
        }
      } else {
        req.payload.logger.error(`Runtime sync failed: ${res.status} ${await res.text()}`)
      }
    } catch (e) {
      req.payload.logger.error(`Runtime sync error: ${String(e)}`)
    }
    return doc
  }
}
