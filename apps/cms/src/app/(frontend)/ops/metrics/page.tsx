'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function MetricsPage() {
  const [tenantId, setTenantId] = useState('')
  const [usage, setUsage] = useState('')
  const [scripts, setScripts] = useState('')

  async function load() {
    const u = await fetch(`/api/runtime?resource=usage&tenantId=${tenantId}`, {
      headers: { 'x-tenant-id': tenantId },
    })
    const s = await fetch(`/api/runtime?resource=script_metrics&tenantId=${tenantId}`, {
      headers: { 'x-tenant-id': tenantId },
    })
    setUsage(JSON.stringify(await u.json(), null, 2))
    setScripts(JSON.stringify(await s.json(), null, 2))
  }

  return (
    <div className="panel">
      <p>
        <Link href="/admin">← Admin</Link>
      </p>
      <h1>Метрики и A/B скриптов</h1>
      <div className="row">
        <input placeholder="Payload Tenant ID (напр. 1)" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <button type="button" onClick={load}>
          Загрузить
        </button>
      </div>
      <h2>Usage (токены / день)</h2>
      <pre>{usage}</pre>
      <h2>Script versions (conversion rate)</h2>
      <pre>{scripts}</pre>
    </div>
  )
}
