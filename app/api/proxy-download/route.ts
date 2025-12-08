import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  try {
    new URL(url) // Validate URL format

    const res = await fetch(url, { headers: { 'User-Agent': 'PodcastApp/1.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const headers = new Headers({
      'Content-Type': res.headers.get('content-type') || 'audio/mpeg',
      'Access-Control-Allow-Origin': '*',
    })

    const contentLength = res.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(res.body, { headers })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Download failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
