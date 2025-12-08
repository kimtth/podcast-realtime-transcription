import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy endpoint for Azure Speech transcription that bypasses Next.js body size limits
 * Architecture: Client -> Next.js API -> Download Audio -> Forward to Azure Speech
 * This avoids sending large files through Next.js Server Actions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { audioUrl, endpoint, apiKey } = body

    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 })
    }

    if (!endpoint || !apiKey) {
      return NextResponse.json({ error: 'Azure endpoint and API key are required' }, { status: 400 })
    }

    // Download audio file from source (podcast CDN)
    console.log(`[proxy-azure-speech] Downloading audio from: ${audioUrl}`)
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
    console.log(`[proxy-azure-speech] Audio downloaded, type: ${contentType}, size: ${contentLength} bytes`)

    // Convert response to blob
    const audioBlob = await audioResponse.blob()

    // Create FormData for Azure Speech API
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.wav')
    formData.append('definition', JSON.stringify({
      locales: ['en-US']
    }))

    // Azure Speech fast transcription API endpoint
    const transcribeUrl = new URL('speechtotext/transcriptions:transcribe', endpoint.endsWith('/') ? endpoint : `${endpoint}/`)
    transcribeUrl.searchParams.append('api-version', '2025-10-15')

    console.log(`[proxy-azure-speech] Forwarding to Azure Speech: ${transcribeUrl.toString()}`)

    const speechResponse = await fetch(transcribeUrl.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      body: formData,
    })

    if (!speechResponse.ok) {
      const errorText = await speechResponse.text()
      console.error(`[proxy-azure-speech] Azure error: ${speechResponse.statusText}`, errorText)
      throw new Error(`Azure error: ${speechResponse.statusText}`)
    }

    const result = await speechResponse.json()
    console.log(`[proxy-azure-speech] Transcription successful`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('[proxy-azure-speech] Error:', error)
    const message = error instanceof Error ? error.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'proxy-azure-speech' })
}
