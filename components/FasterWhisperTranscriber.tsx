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
  originalUrl?: string // Original CDN URL for downloaded episodes (bypasses 1MB upload limit)
  onTranscriptUpdate?: (segments: Segment[]) => void
}

export default function FasterWhisperTranscriber({ audioUrl, originalUrl, onTranscriptUpdate }: FasterWhisperTranscriberProps) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentText, setCurrentText] = useState('')
  const [progress, setProgress] = useState(0)
  const [showConfig, setShowConfig] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const segmentsRef = useRef<Segment[]>([])

  // Load saved config from localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem('faster_whisper_url')
    setServerUrl(savedUrl || 'auto') // Default to auto-detect
  }, [])

  const saveConfig = useCallback(() => {
    const urlToSave = serverUrl.trim() || 'auto'
    
    // Validate only if custom URL
    if (urlToSave !== 'auto') {
      try {
        new URL(urlToSave) // Validate URL
      } catch (e) {
        setError('Invalid URL format')
        return
      }
    }
    
    localStorage.setItem('faster_whisper_url', urlToSave)
    setIsSaved(true)
    setShowConfig(false)
    setTimeout(() => setIsSaved(false), 2000)
  }, [serverUrl])

  const startTranscription = useCallback(async () => {
    const effectiveUrl = (!serverUrl || serverUrl === 'auto') ? 'auto' : serverUrl
    
    if (!effectiveUrl) {
      setError('Faster-Whisper server not configured. Please configure in settings.')
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

      abortControllerRef.current = new AbortController()
      setProgress(25) // Show initial progress

      // For downloaded episodes, use original URL to avoid 1MB upload limit
      // The audioUrl is a blob URL (for playback), but originalUrl has the CDN URL (for transcription)
      const transcriptionUrl = originalUrl || audioUrl

      if (audioUrl.startsWith('blob:')) {
        console.log('[FasterWhisper] Using original CDN URL for transcription:', transcriptionUrl)
      } else {
        console.log('[FasterWhisper] Using audio URL for transcription:', transcriptionUrl)
      }

      // Use the proxy endpoint (server downloads from CDN)
      const transcribeResponse = await fetch(`/api/proxy-transcribe?url=${encodeURIComponent(transcriptionUrl)}&server=${encodeURIComponent(effectiveUrl)}`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
      })

      setProgress(75) // Show progress after transcription completes

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
    setIsTranscribing(false)
    setCurrentText('')
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
                {(!serverUrl || serverUrl === 'auto') 
                  ? 'Using built-in transcription server' 
                  : `Using custom server: ${serverUrl.replace(/^https?:\/\//, '')}`}
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
                <label className="text-sm font-medium">Faster-Whisper Server</label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="server-auto"
                      name="server-type"
                      checked={!serverUrl || serverUrl === 'auto'}
                      onChange={() => setServerUrl('auto')}
                      className="w-4 h-4"
                    />
                    <label htmlFor="server-auto" className="text-sm cursor-pointer">
                      <strong>Auto-detect</strong> (Recommended)
                      <p className="text-xs text-muted-foreground">Uses built-in server if available</p>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="server-custom"
                      name="server-type"
                      checked={!!(serverUrl && serverUrl !== 'auto')}
                      onChange={() => setServerUrl('http://')}
                      className="w-4 h-4"
                    />
                    <label htmlFor="server-custom" className="text-sm cursor-pointer">
                      <strong>Custom server</strong>
                      <p className="text-xs text-muted-foreground">External Faster-Whisper installation</p>
                    </label>
                  </div>
                </div>
                {serverUrl && serverUrl !== 'auto' && (
                  <Input
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8000"
                    className="mt-2"
                  />
                )}
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
