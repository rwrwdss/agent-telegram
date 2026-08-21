'use client'

import Link from 'next/link'
import React from 'react'

export const AdminNav: React.FC = () => {
  return (
    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ fontSize: 12, opacity: 0.7 }}>Runtime</strong>
      <Link href="/ops/connect-telegram">Подключить Telegram</Link>
      <Link href="/ops/live">Live-диалоги</Link>
      <Link href="/ops/campaigns">Кампании</Link>
      <Link href="/ops/metrics">Метрики / A/B</Link>
    </div>
  )
}
