'use client'

import Link from 'next/link'
import React, { useState } from 'react'

export default function ConnectTelegramPage() {
  const [companyId, setCompanyId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [phone, setPhone] = useState('')
  const [loginSessionId, setLoginSessionId] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [log, setLog] = useState('')
  const [error, setError] = useState('')

  async function start() {
    setError('')
    setLog('Отправляем код в Telegram…')
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': companyId },
      body: JSON.stringify({
        action: 'login_start',
        tenantId: companyId,
        telegramAccountId: accountId,
        phone,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Не удалось отправить код. Сервер переписки ещё не подключён.')
      setLog('')
      return
    }
    setLoginSessionId(data.login_session_id)
    setLog('Код отправлен. Введите его ниже.')
  }

  async function confirm() {
    setError('')
    setLog('Подтверждаем номер…')
    const res = await fetch('/api/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': companyId },
      body: JSON.stringify({
        action: 'login_confirm',
        tenantId: companyId,
        loginSessionId,
        code,
        password: password || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Не удалось подтвердить номер')
      setLog('')
      return
    }
    setLog('Готово! Номер подключён и готов к работе.')
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
        <h1>Подключить номер Telegram</h1>
        <p className="lead">
          Сначала создайте запись «Telegram-номер» в кабинете. Затем введите код из приложения
          Telegram — как при обычном входе.
        </p>

        {error ? <div className="error">{error}</div> : null}
        {log ? <div className="ok">{log}</div> : null}

        <div className="field">
          <label>ID компании</label>
          <input
            placeholder="Смотрите в карточке компании в кабинете"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Технический ID номера</label>
          <input
            placeholder="Поле «Технический ID» у Telegram-номера"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Телефон</label>
          <input placeholder="+79001234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" onClick={start}>
          Получить код
        </button>

        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '24px 0' }} />

        <div className="field">
          <label>Код из Telegram</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="12345" />
        </div>
        <div className="field">
          <label>Пароль двухфакторной защиты (если включён)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Необязательно"
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={confirm} disabled={!loginSessionId}>
          Подтвердить и сохранить
        </button>
      </div>
    </div>
  )
}
