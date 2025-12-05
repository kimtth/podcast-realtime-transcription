'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, Square, AlertCircle, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Segment {
  start: number
  end: number
  text: string
  isFinal: boolean
}

interface FasterWhisperTranscriberProps {
  audioUrl: string
  onTranscriptUpdate?: (segments: Segment[]) => void
}

export default function FasterWhisperTranscriber({ audioUrl, onTranscriptUpdate }: FasterWhisperTranscriberProps) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentText, setCurrentText] = useState('')
  const [progress, setProgress] = useState(0)
  const [showConfig, setShowConfig] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const segmentsRef = useRef<Segment[]>([])

  // Load saved config from localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem('faster_whisper_url')
    if (savedUrl) setServerUrl(savedUrl)
  }, [])

  const saveConfig = useCallback(() => {
    if (!serverUrl.trim()) {
      setError('Server URL is required')
      return
    }
    try {
      new URL(serverUrl) // Validate URL
      localStorage.setItem('faster_whisper_url', serverUrl)
      setIsSaved(true)
      setShowConfig(false)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (e) {
      setError('Invalid URL format')
    }
  }, [serverUrl])

  const startTranscription = useCallback(async () => {
    if (!serverUrl.trim()) {
      setError('Faster-Whisper server URL not configured. Please configure in settings.')
      setShowConfig(true)
      return
    }

    try {
      setError(null)
      setIsTranscribing(true)
      setSegments([])
      setCurrentText('')
      setProgress(0)
      segmentsRef.current = []

      // Reset abort flag on backend before starting new transcription
      await fetch(`${serverUrl}/reset-abort`, { method: 'POST' }).catch(() => {
        // Ignore errors from reset endpoint
      })

      const audio = new Audio(audioUrl)
      audio.crossOrigin = 'anonymous'
      audioRef.current = audio

      abortControllerRef.current = new AbortController()

      // Fetch and transcribe audio
      const response = await fetch(audio.src)
      const arrayBuffer = await response.arrayBuffer()

      // Update progress during fetch
      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          const progressPercent = (audio.currentTime / audio.duration) * 100
          setProgress(progressPercent)
        }
      }

      audio.onended = () => {
        setProgress(100)
        setIsTranscribing(false)
      }

      audio.onerror = () => {
        setError('Failed to load audio file')
        setIsTranscribing(false)
      }

      // Send to Faster-Whisper server
      const formData = new FormData()
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
      formData.append('file', blob)

      const transcribeResponse = await fetch(`${serverUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!transcribeResponse.ok) {
        throw new Error(`Server error: ${transcribeResponse.statusText}`)
      }

      const result = await transcribeResponse.json()
      
      // Process segments from response
      const newSegments: Segment[] = (result.segments || []).map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
        isFinal: true,
      }))

      segmentsRef.current = newSegments
      setSegments(newSegments)
      setCurrentText('')

      if (onTranscriptUpdate) {
        onTranscriptUpdate(newSegments)
      }

      setIsTranscribing(false)
      setProgress(100)

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Transcription error:', err)
        setError(err.message || 'Failed to transcribe audio')
      }
      setIsTranscribing(false)
    }
  }, [serverUrl, audioUrl, onTranscriptUpdate])

  const stopTranscription = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsTranscribing(false)
    setCurrentText('')
    setProgress(0)
    setError(null)
    
    // Notify backend to cancel transcription
    if (serverUrl.trim()) {
      fetch(`${serverUrl}/cancel-transcription`, { method: 'POST' }).catch(() => {
        // Ignore errors from cancel endpoint
      })
    }
  }, [serverUrl])

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Faster-Whisper Transcription</h3>
              <p className="text-sm text-muted-foreground">
                GPU-accelerated transcription via local server
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Config
              </Button>
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
          </div>

          {showConfig && (
            <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div>
                <label className="text-sm font-medium">Server URL</label>
                <Input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:8000 or http://your-server:8000"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default: http://localhost:8000
                </p>
              </div>
              <Button onClick={saveConfig} className="w-full">
                Save Configuration
              </Button>
              {isSaved && (
                <p className="text-xs text-green-600">✓ Configuration saved</p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-md">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isTranscribing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Transcribing with GPU...</span>
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
        </div>
      </Card>
    </div>
  )
}
