const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'dev-service-token-change-me'

export type ApiOptions = {
  tenantId: string
  method?: string
  body?: unknown
}

export async function runtimeFetch<T = unknown>(path: string, opts: ApiOptions): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Token': SERVICE_TOKEN,
      'X-Tenant-Id': opts.tenantId,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function wsUrl(tenantId: string): string {
  const base = (process.env.NEXT_PUBLIC_API_WS || 'ws://localhost:8000').replace(/\/$/, '')
  const token = process.env.NEXT_PUBLIC_SERVICE_TOKEN || SERVICE_TOKEN
  return `${base}/ws/tenants/${tenantId}/conversations?token=${encodeURIComponent(token)}`
}
