'use client'

import Link from 'next/link'
import React, { useState } from 'react'

export default function CampaignsPage() {
  const [companyId, setCompanyId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [leadIds, setLeadIds] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  async function start() {
    setError('')
    setResult('')
    const ids = leadIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': companyId },
      body: JSON.stringify({
        action: 'campaign_start',
        tenantId: companyId,
        agentId,
        leadIds: ids,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Не удалось запустить. Сервер переписки ещё не подключён.')
      return
    }
    setResult(`Запущено диалогов: ${data.enqueued || ids.length}`)
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Диалоги
        </Link>
        <Link href="/admin" className="btn btn-ghost">
          В кабинет
        </Link>
      </header>

      <div className="panel">
        <h1>Начать переписку</h1>
        <p className="lead">
          Выберите помощника и список контактов — он напишет первым и пойдёт по сценарию.
        </p>
        {error ? <div className="error">{error}</div> : null}
        {result ? <div className="ok">{result}</div> : null}

        <div className="field">
          <label>ID компании</label>
          <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
        </div>
        <div className="field">
          <label>Технический ID помощника</label>
          <input value={agentId} onChange={(e) => setAgentId(e.target.value)} />
        </div>
        <div className="field">
          <label>Технические ID контактов</label>
          <textarea
            rows={5}
            placeholder="По одному на строку или через запятую"
            value={leadIds}
            onChange={(e) => setLeadIds(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={start}>
          Запустить
        </button>
      </div>
    </div>
  )
}
