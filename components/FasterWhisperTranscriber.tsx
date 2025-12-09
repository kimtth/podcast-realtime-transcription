'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Square, AlertCircle } from 'lucide-react'
import { getSettings } from '@/lib/appSettings'
import TranscriptSegmentList from './TranscriptSegmentList'

interface Segment {
  start: number
  end: number
  text: string
  isFinal: boolean
}

interface FasterWhisperTranscriberProps {
  audioUrl: string
  originalUrl?: string // Original CDN URL for downloaded episodes (bypasses 1MB upload limit)
  onTranscriptUpdate?: (segments: Segment[]) => void
  onSeek?: (time: number) => void
  initialSegments?: Segment[]
}

export default function FasterWhisperTranscriber({ audioUrl, originalUrl, onTranscriptUpdate, onSeek, initialSegments }: FasterWhisperTranscriberProps) {
  const [segments, setSegments] = useState<Segment[]>(initialSegments || [])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)
  const segmentsRef = useRef<Segment[]>([])

  useEffect(() => {
    setSegments(initialSegments || [])
  }, [initialSegments])

  const startTranscription = useCallback(async () => {
    const settings = getSettings()
    const serverUrl = settings.fasterWhisperUrl || 'auto'
    const effectiveUrl = (!serverUrl || serverUrl === 'auto') ? 'auto' : serverUrl

    try {
      setError(null)
      setIsTranscribing(true)
      setSegments([])
      setProgress(0)
      segmentsRef.current = []

      abortControllerRef.current = new AbortController()
      setProgress(25)

      // For downloaded episodes, use original URL to avoid 1MB upload limit
      const transcriptionUrl = originalUrl || audioUrl

      // Use the proxy endpoint (server downloads from CDN)
      const transcribeResponse = await fetch(`/api/proxy-transcribe?url=${encodeURIComponent(transcriptionUrl)}&server=${encodeURIComponent(effectiveUrl)}`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
      })

      setProgress(75)

      if (!transcribeResponse.ok) {
        throw new Error(`Server error: ${transcribeResponse.statusText}`)
      }

      const result = await transcribeResponse.json()
      
      const newSegments: Segment[] = (result.segments || []).map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
        isFinal: true,
      }))

      segmentsRef.current = newSegments
      setSegments(newSegments)
      setProgress(100)

      if (onTranscriptUpdate) {
        onTranscriptUpdate(newSegments)
      }

      setIsTranscribing(false)

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Transcription error:', err)
        setError(err.message || 'Failed to transcribe audio')
      }
      setIsTranscribing(false)
    }
  }, [audioUrl, originalUrl, onTranscriptUpdate])

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
              <h3 className="text-lg font-semibold">Faster-Whisper Transcription</h3>
              <p className="text-sm text-muted-foreground">
                GPU-accelerated transcription (configure server in Settings)
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
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <TranscriptSegmentList segments={segments} onSeek={onSeek} />
        </div>
      </Card>
    </div>
  )
}
