import type { Metadata } from 'next'
import React from 'react'
import './styles.css'

export const metadata: Metadata = {
  title: 'Agent CMS',
  description: 'Telegram AI agents admin',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
