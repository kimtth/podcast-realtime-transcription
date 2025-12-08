import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy endpoint for transcription that bypasses Next.js body size limits
 * 
 * ARCHITECTURE:
 * 1. In Azure deployments: Both Next.js (port 3000) and FastAPI (port 8000) run in same container
 *    - Only port 3000 is exposed publicly
 *    - Port 8000 is internal (localhost only)
 *    - This API route forwards audio from podcast CDNs to internal FastAPI server
 * 
 * 2. User flow:
 *    Browser → Azure:3000 (Next.js) → /api/proxy-transcribe → localhost:8000 (FastAPI) → Transcription
 * 
 * 3. Benefits:
 *    - No Next.js body size limits (audio never goes through Server Actions)
 *    - No need to expose FastAPI port publicly
 *    - Audio streams directly: CDN → Next.js API → FastAPI
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type')
    
    // Handle FormData with audio blob
    if (contentType?.includes('multipart/form-data')) {
      const formData = await req.formData()
      const audioBlob = formData.get('audioBlob') as Blob
      const serverUrl = formData.get('serverUrl') as string

      if (!audioBlob) {
        return NextResponse.json({ error: 'Audio blob is required' }, { status: 400 })
      }

      let transcribeUrl: string
      if (!serverUrl || serverUrl === 'auto') {
        transcribeUrl = 'http://localhost:8000/transcribe'
        console.log(`[proxy-transcribe] Using built-in Faster-Whisper server`)
      } else {
        transcribeUrl = `${serverUrl}/transcribe`
        console.log(`[proxy-transcribe] Using external server: ${transcribeUrl}`)
      }

      // Create FormData for FastAPI
      const apiFormData = new FormData()
      apiFormData.append('file', audioBlob, 'audio.mp3')

      console.log(`[proxy-transcribe] Forwarding to: ${transcribeUrl}`)

      const transcribeResponse = await fetch(transcribeUrl, {
        method: 'POST',
        body: apiFormData,
      })

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text()
        console.error(`[proxy-transcribe] Transcription failed: ${transcribeResponse.statusText}`, errorText)
        throw new Error(`Transcription failed: ${transcribeResponse.statusText}`)
      }

      const result = await transcribeResponse.json()
      console.log(`[proxy-transcribe] Transcription successful, segments: ${result.segments?.length || 0}`)

      return NextResponse.json(result)
    } else {
      // Handle URL parameters (legacy support)
      const { searchParams } = new URL(req.url)
      const audioUrl = searchParams.get('url')
      const serverUrl = searchParams.get('server')

      if (!audioUrl) {
        return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 })
      }

      // Skip blob: URLs - they can't be fetched from server
      if (audioUrl.startsWith('blob:')) {
        return NextResponse.json({ 
          error: 'Cannot transcribe blob URLs. Please ensure originalUrl is passed.' 
        }, { status: 400 })
      }

      let transcribeUrl: string
      if (!serverUrl || serverUrl === 'auto') {
        transcribeUrl = 'http://localhost:8000/transcribe'
        console.log(`[proxy-transcribe] Using built-in Faster-Whisper server`)
      } else {
        transcribeUrl = `${serverUrl}/transcribe`
        console.log(`[proxy-transcribe] Using external server: ${transcribeUrl}`)
      }

      // Download audio file from source (podcast CDN)
      console.log(`[proxy-transcribe] Downloading audio from: ${audioUrl}`)
      const audioResponse = await fetch(audioUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PodcastTranscriber/1.0)',
        },
      })

      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`)
      }

      const audioBlob = await audioResponse.blob()

      // Create FormData for FastAPI
      const apiFormData = new FormData()
      apiFormData.append('file', audioBlob, 'audio.mp3')

      console.log(`[proxy-transcribe] Forwarding to: ${transcribeUrl}`)

      const transcribeResponse = await fetch(transcribeUrl, {
        method: 'POST',
        body: apiFormData,
      })

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text()
        console.error(`[proxy-transcribe] Transcription failed: ${transcribeResponse.statusText}`, errorText)
        throw new Error(`Transcription failed: ${transcribeResponse.statusText}`)
      }

      const result = await transcribeResponse.json()
      console.log(`[proxy-transcribe] Transcription successful, segments: ${result.segments?.length || 0}`)

      return NextResponse.json(result)
    }

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
