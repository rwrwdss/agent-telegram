import { NextRequest, NextResponse } from 'next/server'
import { runtimeFetch } from '@/lib/runtime'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const tenantId = req.headers.get('x-tenant-id') || body.tenantId
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  try {
    if (body.action === 'login_start') {
      const data = await runtimeFetch('/telegram/login/start', {
        tenantId,
        method: 'POST',
        body: {
          telegram_account_id: body.telegramAccountId,
          phone: body.phone,
        },
      })
      return NextResponse.json(data)
    }
    if (body.action === 'login_confirm') {
      const data = await runtimeFetch('/telegram/login/confirm', {
        tenantId,
        method: 'POST',
        body: {
          login_session_id: body.loginSessionId,
          code: body.code,
          password: body.password,
        },
      })
      return NextResponse.json(data)
    }
    if (body.action === 'campaign_start') {
      const data = await runtimeFetch('/campaigns/start', {
        tenantId,
        method: 'POST',
        body: { agent_id: body.agentId, lead_ids: body.leadIds },
      })
      return NextResponse.json(data)
    }
    if (body.action === 'handoff') {
      const data = await runtimeFetch(`/conversations/${body.conversationId}/handoff`, {
        tenantId,
        method: 'POST',
      })
      return NextResponse.json(data)
    }
    if (body.action === 'resume_bot') {
      const data = await runtimeFetch(`/conversations/${body.conversationId}/resume-bot`, {
        tenantId,
        method: 'POST',
      })
      return NextResponse.json(data)
    }
    if (body.action === 'operator_message') {
      const data = await runtimeFetch(`/conversations/${body.conversationId}/operator-message`, {
        tenantId,
        method: 'POST',
        body: { text: body.text },
      })
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenantId')
  const resource = req.nextUrl.searchParams.get('resource')
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  try {
    if (resource === 'conversations') {
      const state = req.nextUrl.searchParams.get('state')
      const path = state ? `/conversations?state=${state}` : '/conversations'
      const data = await runtimeFetch(path, { tenantId })
      return NextResponse.json(data)
    }
    if (resource === 'messages') {
      const id = req.nextUrl.searchParams.get('conversationId')
      const data = await runtimeFetch(`/conversations/${id}/messages`, { tenantId })
      return NextResponse.json(data)
    }
    if (resource === 'accounts') {
      const data = await runtimeFetch('/telegram/accounts', { tenantId })
      return NextResponse.json(data)
    }
    if (resource === 'usage') {
      const data = await runtimeFetch('/metrics/usage', { tenantId })
      return NextResponse.json(data)
    }
    if (resource === 'script_metrics') {
      const data = await runtimeFetch('/metrics/scripts', { tenantId })
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: 'unknown resource' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
