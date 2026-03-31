import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduRun',
  description: 'Passive assessment for AI tutor sessions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
