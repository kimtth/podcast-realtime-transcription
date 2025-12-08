import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy endpoint for Azure Speech transcription via FastAPI
 * Bypasses Next.js body size limits
 */
export async function POST(req: NextRequest) {
  try {
    const requestContentType = req.headers.get('content-type') || ''
    let endpoint: string | null = null
    let apiKey: string | null = null
    let audioUrl: string | null = null
    let locale: string | null = null
    let uploadedBlob: Blob | null = null

    if (requestContentType.includes('application/json')) {
      const body = await req.json()
      endpoint = body.endpoint ?? null
      apiKey = body.apiKey ?? null
      audioUrl = body.audioUrl ?? null
      locale = body.locale ?? null
    } else if (requestContentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      endpoint = formData.get('endpoint') as string | null
      apiKey = formData.get('apiKey') as string | null
      audioUrl = formData.get('audioUrl') as string | null
      locale = (formData.get('locale') as string | null) ?? null
      uploadedBlob = formData.get('audioBlob') as Blob | null
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
    }

    if (!endpoint || !apiKey) {
      return NextResponse.json({ error: 'Azure endpoint and key required' }, { status: 400 })
    }

    if (!uploadedBlob && !audioUrl) return NextResponse.json({ error: 'audioUrl or audioBlob is required' }, { status: 400 })

    let audioBlob: Blob
    if (uploadedBlob) {
      audioBlob = uploadedBlob
    } else {
      // Download audio server-side first
      const audioRes = await fetch(audioUrl!, { headers: { 'User-Agent': 'PodcastTranscriber/1.0' } }).catch((err: any) => err)
      if (!(audioRes instanceof Response) || !audioRes.ok || !audioRes.body) {
        const status = audioRes instanceof Response ? audioRes.status : 502
        const message = audioRes instanceof Response ? audioRes.statusText : 'download failed'
        return NextResponse.json({ error: `Failed to download audio: ${message}`, status, stage: 'download' }, { status })
      }

      audioBlob = await audioRes.blob()
    }

    // Use fast transcription API: https://{region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe
    const base = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
    const transcribeUrl = `${base}/speechtotext/transcriptions:transcribe?api-version=2025-10-15`

    console.log(`[proxy-azure-speech] Fast transcription endpoint: ${transcribeUrl}`)

    const definition = JSON.stringify({
      locales: locale ? [locale] : ['en-US'],
    })

    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.wav')
    formData.append('definition', definition)

    const azureRes = await fetch(transcribeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      body: formData,
    }).catch((err: any) => err)

    if (!(azureRes instanceof Response)) {
      const msg = azureRes instanceof Error ? azureRes.message : 'request failed'
      return NextResponse.json({ error: `Azure request failed: ${msg}`, stage: 'azure-request' }, { status: 502 })
    }

    if (!azureRes.ok) {
      const text = await azureRes.text()
      console.error('Azure fast transcription error', azureRes.status, text)
      return NextResponse.json({ error: 'Azure fast transcription failed', status: azureRes.status, azureBody: text, stage: 'azure-response' }, { status: azureRes.status })
    }

    const azureJson = await azureRes.json()

    // Extract text from combinedPhrases
    const combinedPhrases = azureJson?.combinedPhrases || []
    const transcriptionText = combinedPhrases.map((p: any) => p.text || '').join(' ')

    return NextResponse.json({
      text: transcriptionText,
      raw: azureJson,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Transcription failed'
    console.error('[proxy-azure-speech] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'proxy-azure-speech' })
}
