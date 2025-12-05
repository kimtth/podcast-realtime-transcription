import './globals.css'
import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Podcast Player',
  description: 'Podcast player with live transcription',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
