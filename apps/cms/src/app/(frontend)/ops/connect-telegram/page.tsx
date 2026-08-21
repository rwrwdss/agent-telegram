'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function ConnectTelegramPage() {
  const [tenantId, setTenantId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [phone, setPhone] = useState('')
  const [loginSessionId, setLoginSessionId] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [log, setLog] = useState('')

  async function start() {
    setLog('Отправка кода...')
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        action: 'login_start',
        tenantId,
        telegramAccountId: accountId,
        phone,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setLog(JSON.stringify(data))
      return
    }
    setLoginSessionId(data.login_session_id)
    setLog('Код отправлен. Введите код из Telegram.')
  }

  async function confirm() {
    setLog('Подтверждение...')
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        action: 'login_confirm',
        tenantId,
        loginSessionId,
        code,
        password: password || undefined,
      }),
    })
    const data = await res.json()
    setLog(JSON.stringify(data, null, 2))
  }

  return (
    <div className="panel">
      <p>
        <Link href="/admin">← Admin</Link>
      </p>
      <h1>Подключить Telegram-аккаунт</h1>
      <p>Сначала создайте запись в Telegram Accounts и синхронизируйте runtimeId.</p>
      <div className="row">
        <input placeholder="Payload Tenant ID (напр. 1)" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <input
          placeholder="Runtime telegram_account UUID"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          style={{ minWidth: 320 }}
        />
      </div>
      <div className="row">
        <input placeholder="+7900..." value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button type="button" onClick={start}>
          Отправить код
        </button>
      </div>
      <div className="row">
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} />
        <input
          placeholder="2FA пароль (если есть)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" onClick={confirm} disabled={!loginSessionId}>
          Подтвердить
        </button>
      </div>
      <pre>{log}</pre>
    </div>
  )
}
