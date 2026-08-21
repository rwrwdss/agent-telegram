'use client'

import Link from 'next/link'
import React, { useState } from 'react'

export default function MetricsPage() {
  const [companyId, setCompanyId] = useState('')
  const [usage, setUsage] = useState<Array<Record<string, unknown>>>([])
  const [scripts, setScripts] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const u = await fetch(`/api/runtime?resource=usage&tenantId=${companyId}`, {
      headers: { 'x-tenant-id': companyId },
    })
    const s = await fetch(`/api/runtime?resource=script_metrics&tenantId=${companyId}`, {
      headers: { 'x-tenant-id': companyId },
    })
    const uj = await u.json()
    const sj = await s.json()
    if (!u.ok || !s.ok) {
      setError(uj.error || sj.error || 'Сервер переписки ещё не подключён')
      return
    }
    setUsage(Array.isArray(uj) ? uj : [])
    setScripts(Array.isArray(sj) ? sj : [])
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
        <h1>Результаты</h1>
        <p className="lead">Сколько диалогов начато, сколько дошли до договорённости, расход ИИ.</p>
        {error ? <div className="error">{error}</div> : null}

        <div className="row">
          <input
            placeholder="ID компании"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={load}>
            Показать
          </button>
        </div>

        <h2 style={{ fontSize: '1.1rem', marginTop: 28 }}>По дням</h2>
        {!usage.length ? (
          <p className="muted">Пока нет данных</p>
        ) : (
          usage.map((row) => (
            <div key={String(row.day)} className="card">
              <strong>{String(row.day)}</strong>
              <div className="muted">
                Диалогов: {String(row.conversations_started)} · Договорились: {String(row.conversions)} ·
                Исходящих: {String(row.messages_out)} · Токены ИИ: {String(row.tokens_total)}
              </div>
            </div>
          ))
        )}

        <h2 style={{ fontSize: '1.1rem', marginTop: 28 }}>Версии сценариев</h2>
        {!scripts.length ? (
          <p className="muted">Пока нет данных</p>
        ) : (
          scripts.map((row, i) => (
            <div key={`${row.script_id}-${row.script_version}-${i}`} className="card">
              <strong>
                Версия {String(row.script_version)}
              </strong>
              <div className="muted">
                Старт: {String(row.started)} · Успех: {String(row.converted)} · Передано людям:{' '}
                {String(row.handoffs)} · Конверсия: {Math.round(Number(row.conversion_rate || 0) * 100)}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
