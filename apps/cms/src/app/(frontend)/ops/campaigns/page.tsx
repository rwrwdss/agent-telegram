'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function CampaignsPage() {
  const [tenantId, setTenantId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [leadIds, setLeadIds] = useState('')
  const [result, setResult] = useState('')

  async function start() {
    const ids = leadIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        action: 'campaign_start',
        tenantId,
        agentId,
        leadIds: ids,
      }),
    })
    const data = await res.json()
    setResult(JSON.stringify(data, null, 2))
  }

  return (
    <div className="panel">
      <p>
        <Link href="/admin">← Admin</Link>
      </p>
      <h1>Старт кампании</h1>
      <p>Укажите runtime UUID агента и лидов (после sync из Payload).</p>
      <div className="row">
        <input placeholder="Payload Tenant ID (напр. 1)" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
      </div>
      <div className="row">
        <input
          placeholder="Agent runtime UUID"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          style={{ minWidth: 360 }}
        />
      </div>
      <div className="row">
        <textarea
          rows={5}
          style={{ width: '100%' }}
          placeholder="Lead runtime UUIDs через запятую или с новой строки"
          value={leadIds}
          onChange={(e) => setLeadIds(e.target.value)}
        />
      </div>
      <button type="button" onClick={start}>
        Запустить
      </button>
      <pre>{result}</pre>
    </div>
  )
}
