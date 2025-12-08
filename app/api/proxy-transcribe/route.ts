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
    const { searchParams } = new URL(req.url)
    const audioUrl = searchParams.get('url')
    const serverUrl = searchParams.get('server')

    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 })
    }

    // Auto-detect server: try built-in first, fall back to external if provided
    let transcribeUrl: string
    
    if (!serverUrl || serverUrl === 'auto') {
      // Auto mode: use built-in server
      transcribeUrl = 'http://localhost:8000/transcribe'
      console.log(`[proxy-transcribe] Using built-in Faster-Whisper server`)
    } else {
      // Custom external server
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

    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg'
    const contentLength = audioResponse.headers.get('content-length')
    console.log(`[proxy-transcribe] Audio downloaded, type: ${contentType}, size: ${contentLength} bytes`)

    // Convert response to blob
    const audioBlob = await audioResponse.blob()

    // Create FormData for transcription API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.mp3')

    console.log(`[proxy-transcribe] Forwarding to: ${transcribeUrl}`)

    const transcribeResponse = await fetch(transcribeUrl, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type, let browser set it with boundary for multipart/form-data
    })

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text()
      console.error(`[proxy-transcribe] Transcription failed: ${transcribeResponse.statusText}`, errorText)
      throw new Error(`Transcription failed: ${transcribeResponse.statusText}`)
    }

    const result = await transcribeResponse.json()
    console.log(`[proxy-transcribe] Transcription successful, segments: ${result.segments?.length || 0}`)

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
