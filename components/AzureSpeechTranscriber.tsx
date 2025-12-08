'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, Square, AlertCircle } from 'lucide-react'
import { getSettings } from '@/lib/appSettings'
import { saveTranscript } from '@/lib/storage'
import { splitTranscriptionIntoSegments } from '@/lib/utils'

interface Segment {
  start: number
  end: number
  text: string
  isFinal: boolean
}

interface AzureSpeechTranscriberProps {
  audioUrl: string
  episodeId?: number | string
  podcastId?: number
  onTranscriptUpdate?: (segments: Segment[]) => void
  onSeek?: (time: number) => void
  initialSegments?: Segment[]
}

export default function AzureSpeechTranscriber({ audioUrl, episodeId, podcastId, onTranscriptUpdate, onSeek, initialSegments }: AzureSpeechTranscriberProps) {
  const [segments, setSegments] = useState<Segment[]>(initialSegments || [])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const startTranscription = useCallback(async () => {
    const settings = getSettings()
    const apiKey = settings.azureSpeechKey
    const endpoint = settings.azureSpeechEndpoint
    const locale = settings.azureSpeechLocale || 'en-US'

    if (!apiKey || !endpoint) {
      setError('Azure credentials not configured. Please set them in Settings.')
      return
    }

    try {
      setError(null)
      setIsTranscribing(true)
      setSegments([])
      setProgress(0)

      abortControllerRef.current = new AbortController()

      const readError = async (res: Response) => {
        const text = await res.text()
        try {
          return { text, parsed: JSON.parse(text) }
        } catch (_) {
          return { text }
        }
      }

      const postJson = () => fetch(`/api/proxy-azure-speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl, endpoint, apiKey, locale }),
        signal: abortControllerRef.current!.signal,
      })

      const postBlob = async () => {
        const blobRes = await fetch(audioUrl, { signal: abortControllerRef.current!.signal })
        if (!blobRes.ok) throw new Error(`Failed to fetch audio locally: ${blobRes.statusText}`)
        const fd = new FormData()
        fd.append('audioBlob', await blobRes.blob(), 'audio.wav')
        fd.append('endpoint', endpoint)
        fd.append('apiKey', apiKey)
        fd.append('locale', locale)
        return fetch(`/api/proxy-azure-speech`, { method: 'POST', body: fd, signal: abortControllerRef.current!.signal })
      }

      let speechResponse = await postJson()
      if (!speechResponse.ok) {
        const err = await readError(speechResponse)
        if (err.parsed?.stage === 'download') speechResponse = await postBlob()
      }

      setProgress(50)

      if (!speechResponse.ok) {
        const err = await readError(speechResponse)
        const msg = err.parsed?.error || err.text || 'Azure error'
        throw new Error(msg)
      }

      const result = await speechResponse.json()

      // Prefer Azure offsets for accurate tap-to-seek
      const phrases = Array.isArray(result?.combinedPhrases) && result.combinedPhrases.length
        ? result.combinedPhrases
        : Array.isArray(result?.phrases) && result.phrases.length
          ? result.phrases
          : null

      const azureSegments: Segment[] | null = phrases
        ? phrases
            .map((p: any) => {
              const text = p.text || p.display || p.lexical || ''
              if (!text) return null
              const start = (p.offsetMilliseconds ?? p.offset ?? 0) / 1000
              const durMs = p.durationMilliseconds ?? p.duration ?? 0
              const end = durMs ? start + durMs / 1000 : start + 5
              return { start, end, text, isFinal: true }
            })
            .filter(Boolean) as Segment[]
        : null

      const transcriptionText = result.text || result.combinedPhrases?.[0]?.text || result.phrases?.[0]?.text || ''

      let mapped: Segment[] = []

      if (azureSegments && azureSegments.length) {
        mapped = azureSegments
      } else if (transcriptionText) {
        const durationMs = result.duration || result.durationMilliseconds || transcriptionText.split(' ').length * 300 // rough estimate
        mapped = splitTranscriptionIntoSegments(transcriptionText, durationMs, 8).map(seg => ({ ...seg, isFinal: true }))
      }

      if (mapped.length > 0) {

        setSegments(mapped)
        setProgress(100)

        if (episodeId && podcastId) {
          // Persist for this engine
          saveTranscript(
            episodeId,
            podcastId,
            'azure',
            mapped.map(m => ({ text: m.text, time: m.start }))
          )
        }

        if (onTranscriptUpdate) {
          onTranscriptUpdate(mapped)
        }
      } else {
        setError('No transcription text received')
      }

      setIsTranscribing(false)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Error:', err)
        setError(err.message || 'Transcription failed')
      }
      setIsTranscribing(false)
    }
  }, [audioUrl, onTranscriptUpdate, episodeId, podcastId])

  const stopTranscription = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsTranscribing(false)
    setProgress(0)
    setError(null)
  }, [])

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Azure AI Speech Transcription</h3>
              <p className="text-sm text-muted-foreground">
                Cloud-based transcription with high accuracy
              </p>
            </div>
            <Button
              onClick={isTranscribing ? stopTranscription : startTranscription}
              variant={isTranscribing ? 'destructive' : 'default'}
              disabled={!audioUrl}
            >
              {isTranscribing ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-md">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isTranscribing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Transcribing...</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {segments.length > 0 && (
            <ScrollArea className="h-64 border rounded-lg p-4">
              <div className="space-y-2">
                {segments.map((seg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSeek?.(seg.start)}
                    className="w-full text-left text-sm p-2 rounded hover:bg-muted transition"
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {new Date(seg.start * 1000).toISOString().substr(11, 8)}
                    </span>
                    <span>{seg.text}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </Card>
    </div>
  )
}
