'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export default function RegisterPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Не удалось создать кабинет')
        return
      }
      setOk('Кабинет создан. Входим…')
      const login = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (login.ok) {
        router.push('/admin')
        router.refresh()
        return
      }
      router.push('/login')
    } catch {
      setError('Что-то пошло не так. Попробуйте ещё раз.')
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
        <Link href="/login" className="btn btn-ghost">
          Уже есть кабинет
        </Link>
      </header>

      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Создать кабинет</h1>
          <p className="lead">Укажите компанию и данные владельца — дальше всё в одном месте</p>
          {error ? <div className="error">{error}</div> : null}
          {ok ? <div className="ok">{ok}</div> : null}
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="company">Название компании</label>
              <input
                id="company"
                required
                minLength={2}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Например: Студия Ивана"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Ваш email</label>
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Создаём…' : 'Создать и войти'}
            </button>
          </form>
          <p className="footer-note">
            Уже регистрировались? <Link href="/login">Войти</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
