'use client'

import Link from 'next/link'
import React from 'react'

const linkStyle: React.CSSProperties = {
  display: 'block',
  padding: '8px 10px',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'inherit',
  fontSize: 14,
}

export const AdminNav: React.FC = () => {
  return (
    <nav style={{ padding: '12px 10px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          opacity: 0.55,
          padding: '4px 10px 8px',
        }}
      >
        Быстрые действия
      </div>
      <Link href="/ops/connect-telegram" style={linkStyle}>
        Подключить номер
      </Link>
      <Link href="/ops/campaigns" style={linkStyle}>
        Начать переписку
      </Link>
      <Link href="/ops/live" style={linkStyle}>
        Живые диалоги
      </Link>
      <Link href="/ops/metrics" style={linkStyle}>
        Результаты
      </Link>
      <Link href="/" style={{ ...linkStyle, opacity: 0.7, marginTop: 8 }}>
        На главную
      </Link>
    </nav>
  )
}
