import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Campaign Automation',
  description: 'Email campaign automation powered by PayloadCMS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
