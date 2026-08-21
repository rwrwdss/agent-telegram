'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

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

export default function LiveDialogsPage() {
  const [tenantId, setTenantId] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('')

  const loadConversations = useCallback(async () => {
    if (!tenantId) return
    const res = await fetch(`/api/runtime?resource=conversations&tenantId=${tenantId}`, {
      headers: { 'x-tenant-id': tenantId },
    })
    const data = await res.json()
    if (res.ok) setConversations(data)
    else setStatus(JSON.stringify(data))
  }, [tenantId])

  const loadMessages = useCallback(async (id: string) => {
    if (!tenantId) return
    const res = await fetch(
      `/api/runtime?resource=messages&tenantId=${tenantId}&conversationId=${id}`,
      { headers: { 'x-tenant-id': tenantId } },
    )
    const data = await res.json()
    if (res.ok) setMessages(data)
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    loadConversations()
    const wsBase = process.env.NEXT_PUBLIC_API_WS || 'ws://localhost:8000'
    const token = process.env.NEXT_PUBLIC_SERVICE_TOKEN || 'dev-service-token-change-me'
    const ws = new WebSocket(
      `${wsBase}/ws/tenants/${tenantId}/conversations?token=${encodeURIComponent(token)}`,
    )
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        setStatus(`event: ${data.type}`)
        loadConversations()
        if (selected && data.conversation_id === selected) loadMessages(selected)
      } catch {
        /* ignore */
      }
    }
    const t = setInterval(loadConversations, 15000)
    return () => {
      ws.close()
      clearInterval(t)
    }
  }, [tenantId, selected, loadConversations, loadMessages])

  useEffect(() => {
    if (selected) loadMessages(selected)
  }, [selected, loadMessages])

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!tenantId || !selected) return
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({ action, tenantId, conversationId: selected, ...extra }),
    })
    const data = await res.json()
    setStatus(JSON.stringify(data))
    await loadConversations()
    await loadMessages(selected)
  }

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selected),
    [conversations, selected],
  )

  return (
    <div className="panel" style={{ maxWidth: 1100 }}>
      <p>
        <Link href="/admin">← Admin</Link>
      </p>
      <h1>Live-диалоги</h1>
      <div className="row">
        <input
          placeholder="Payload Tenant ID (напр. 1)"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          style={{ minWidth: 320 }}
        />
        <button type="button" className="secondary" onClick={loadConversations}>
          Обновить
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <div>
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              className="card"
              style={{
                width: '100%',
                textAlign: 'left',
                background: selected === c.id ? '#111' : '#fff',
                color: selected === c.id ? '#fff' : '#111',
              }}
              onClick={() => setSelected(c.id)}
            >
              <div className="badge">{c.state}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>{c.id.slice(0, 8)}…</div>
              <div style={{ fontSize: 12 }}>step: {c.current_step}</div>
            </button>
          ))}
        </div>
        <div>
          {selectedConv ? (
            <>
              <div className="row">
                <span className="badge">{selectedConv.state}</span>
                <button type="button" onClick={() => act('handoff')}>
                  Handoff
                </button>
                <button type="button" className="secondary" onClick={() => act('resume_bot')}>
                  Вернуть боту
                </button>
              </div>
              <div className="messages">
                {messages.map((m) => (
                  <div key={m.id} className={m.direction === 'in' ? 'msg-in' : 'msg-out'}>
                    <small>
                      {m.source} · {m.direction}
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
                  placeholder="Сообщение оператора"
                />
                <button
                  type="button"
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
            <p>Выберите диалог</p>
          )}
          <pre style={{ marginTop: 12 }}>{status}</pre>
        </div>
      </div>
    </div>
  )
}
