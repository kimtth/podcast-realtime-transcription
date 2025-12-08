import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy endpoint for transcription via FastAPI (internal port 8000)
 * Bypasses Next.js body size limits by forwarding audio directly to FastAPI
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let audioBlob: Blob | null = null
    let serverUrl: string | null = null

    // Parse input: either FormData (client blob) or URL params (CDN download)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      audioBlob = formData.get('audioBlob') as Blob | null
      serverUrl = formData.get('serverUrl') as string | null

      if (!audioBlob) {
        return NextResponse.json({ error: 'Audio blob required' }, { status: 400 })
      }
    } else {
      const { searchParams } = new URL(req.url)
      const audioUrl = searchParams.get('url')
      serverUrl = searchParams.get('server')

      if (!audioUrl) {
        return NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
      }

      if (audioUrl.startsWith('blob:')) {
        return NextResponse.json({ error: 'Blob URLs not supported, use FormData' }, { status: 400 })
      }

      // Download from CDN
      const res = await fetch(audioUrl, {
        headers: { 'User-Agent': 'PodcastTranscriber/1.0' },
      })
      if (!res.ok) throw new Error(`Download failed: ${res.statusText}`)
      audioBlob = await res.blob()
    }

    // Determine FastAPI endpoint
    const transcribeUrl = !serverUrl || serverUrl === 'auto'
      ? 'http://localhost:8000/transcribe'
      : `${serverUrl}/transcribe`

    // Forward to FastAPI
    const apiData = new FormData()
    apiData.append('file', audioBlob, 'audio.mp3')

    const res = await fetch(transcribeUrl, { method: 'POST', body: apiData })
    if (!res.ok) throw new Error(`FastAPI error: ${res.statusText}`)

    const result = await res.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('[proxy-transcribe] Error:', error)
    const message = error instanceof Error ? error.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'proxy-transcribe' })
}
