'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.errors?.[0]?.message || data?.message || 'Неверный email или пароль')
        return
      }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Не удалось войти. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Диалоги
        </Link>
        <Link href="/register" className="btn btn-ghost">
          Создать кабинет
        </Link>
      </header>

      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Вход</h1>
          <p className="lead">Войдите в кабинет своей компании</p>
          {error ? <div className="error">{error}</div> : null}
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Входим…' : 'Войти'}
            </button>
          </form>
          <p className="footer-note">
            Нет кабинета? <Link href="/register">Зарегистрироваться</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
