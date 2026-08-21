'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

type Conversation = {
  id: string
  state: string
  current_step: string
  lead_id: string
  agent_id: string
  last_message_at: string | null
}

type Message = {
  id: string
  direction: string
  text: string
  source: string
  created_at: string
}

const stateLabel: Record<string, string> = {
  bot: 'Помощник',
  handoff_human: 'У оператора',
  closed: 'Закрыт',
}

export default function LiveDialogsPage() {
  const [companyId, setCompanyId] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('')

  const loadConversations = useCallback(async () => {
    if (!companyId) return
    const res = await fetch(`/api/runtime?resource=conversations&tenantId=${companyId}`, {
      headers: { 'x-tenant-id': companyId },
    })
    const data = await res.json()
    if (res.ok) setConversations(data)
    else setStatus(data.error || 'Сервер переписки ещё не подключён')
  }, [companyId])

  const loadMessages = useCallback(
    async (id: string) => {
      if (!companyId) return
      const res = await fetch(
        `/api/runtime?resource=messages&tenantId=${companyId}&conversationId=${id}`,
        { headers: { 'x-tenant-id': companyId } },
      )
      const data = await res.json()
      if (res.ok) setMessages(data)
    },
    [companyId],
  )

  useEffect(() => {
    if (!companyId) return
    loadConversations()
    const wsBase = process.env.NEXT_PUBLIC_API_WS || 'ws://localhost:8000'
    const token = process.env.NEXT_PUBLIC_SERVICE_TOKEN || 'dev-service-token-change-me'
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(
        `${wsBase}/ws/tenants/${companyId}/conversations?token=${encodeURIComponent(token)}`,
      )
      ws.onmessage = () => {
        loadConversations()
        if (selected) loadMessages(selected)
      }
    } catch {
      /* runtime may be offline */
    }
    const t = setInterval(loadConversations, 15000)
    return () => {
      ws?.close()
      clearInterval(t)
    }
  }, [companyId, selected, loadConversations, loadMessages])

  useEffect(() => {
    if (selected) loadMessages(selected)
  }, [selected, loadMessages])

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!companyId || !selected) return
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': companyId },
      body: JSON.stringify({ action, tenantId: companyId, conversationId: selected, ...extra }),
    })
    const data = await res.json()
    setStatus(res.ok ? 'Готово' : data.error || 'Ошибка')
    await loadConversations()
    await loadMessages(selected)
  }

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selected),
    [conversations, selected],
  )

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
        <h1>Живые диалоги</h1>
        <p className="lead">Смотрите переписку в реальном времени и при необходимости отвечайте сами.</p>

        <div className="row">
          <input
            placeholder="ID компании"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <button type="button" className="btn btn-ghost" onClick={loadConversations}>
            Обновить
          </button>
        </div>
        {status ? <div className="muted">{status}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 16 }}>
          <div>
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className="card"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: selected === c.id ? 'var(--accent)' : undefined,
                  background: selected === c.id ? 'var(--accent-soft)' : undefined,
                }}
                onClick={() => setSelected(c.id)}
              >
                <span className="badge">{stateLabel[c.state] || c.state}</span>
                <div className="muted" style={{ marginTop: 8 }}>
                  Этап: {c.current_step}
                </div>
              </button>
            ))}
            {!conversations.length ? <p className="muted">Пока нет диалогов</p> : null}
          </div>

          <div>
            {selectedConv ? (
              <>
                <div className="row">
                  <span className="badge">{stateLabel[selectedConv.state] || selectedConv.state}</span>
                  <button type="button" className="btn btn-primary" onClick={() => act('handoff')}>
                    Взять себе
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => act('resume_bot')}>
                    Вернуть помощнику
                  </button>
                </div>
                <div className="messages">
                  {messages.map((m) => (
                    <div key={m.id} className={m.direction === 'in' ? 'msg-in' : 'msg-out'}>
                      <small className="muted">
                        {m.direction === 'in' ? 'Клиент' : m.source === 'operator' ? 'Вы' : 'Помощник'}
                      </small>
                      <div>{m.text}</div>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <textarea
                    rows={2}
                    style={{ flex: 1 }}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Ваш ответ клиенту"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      act('operator_message', { text: reply })
                      setReply('')
                    }}
                  >
                    Отправить
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Выберите диалог слева</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
