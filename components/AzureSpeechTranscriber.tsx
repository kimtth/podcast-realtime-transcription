'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, Square, AlertCircle, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
}

export default function AzureSpeechTranscriber({ audioUrl, episodeId, podcastId, onTranscriptUpdate }: AzureSpeechTranscriberProps) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentText, setCurrentText] = useState('')
  const [progress, setProgress] = useState(0)
  const [showConfig, setShowConfig] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('https://eastus.api.cognitive.microsoft.com')
  const [isSaved, setIsSaved] = useState(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Load saved config
  useEffect(() => {
    const savedKey = localStorage.getItem('azure_speech_key')
    const savedEndpoint = localStorage.getItem('azure_speech_endpoint')
    if (savedKey) setApiKey(savedKey)
    if (savedEndpoint) setEndpoint(savedEndpoint)
  }, [])

  const saveConfig = useCallback(() => {
    if (!apiKey.trim()) {
      setError('API Key is required')
      return
    }
    if (!endpoint.trim()) {
      setError('Endpoint is required')
      return
    }
    localStorage.setItem('azure_speech_key', apiKey)
    localStorage.setItem('azure_speech_endpoint', endpoint)
    setIsSaved(true)
    setShowConfig(false)
    setTimeout(() => setIsSaved(false), 2000)
  }, [apiKey, endpoint])

  const startTranscription = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('Azure Speech API Key not configured. Please configure in settings.')
      setShowConfig(true)
      return
    }

    try {
      setError(null)
      setIsTranscribing(true)
      setSegments([])
      setCurrentText('')
      setProgress(0)

      abortControllerRef.current = new AbortController()

      const response = await fetch(audioUrl, { signal: abortControllerRef.current.signal })
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      // Use multipart/form-data for Azure Speech fast transcription API
      const formData = new FormData()
      formData.append('audio', blob, 'audio.wav')
      formData.append('definition', JSON.stringify({
        locales: ['en-US']
      }))

      // Azure Speech fast transcription API endpoint
      const transcribeUrl = new URL('speechtotext/transcriptions:transcribe', endpoint.endsWith('/') ? endpoint : `${endpoint}/`)
      transcribeUrl.searchParams.append('api-version', '2025-10-15')

      const speechResponse = await fetch(transcribeUrl.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!speechResponse.ok) {
        throw new Error(`Azure error: ${speechResponse.statusText}`)
      }

      const result = await speechResponse.json()

      // Extract transcription text from fast transcription API response
      const transcriptionText = result.combinedPhrases?.[0]?.text || 
                                result.phrases?.[0]?.text ||
                                result.text || 
                                'Transcription successful'

      if (transcriptionText) {
        // Estimate duration assuming 16kHz mono 16-bit PCM; fall back to blob size heuristic
        const bytesPerSecond = 16000 * 2 // 16kHz * 16-bit mono
        const durationSeconds = bytesPerSecond > 0 ? blob.size / bytesPerSecond : 0
        const durationMs = durationSeconds * 1000

        const split = splitTranscriptionIntoSegments(transcriptionText, durationMs, 8)
        const mapped: Segment[] = split.map(seg => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
          isFinal: true,
        }))

        setSegments(mapped)
        setCurrentText('')
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
  }, [apiKey, endpoint, audioUrl, onTranscriptUpdate, episodeId, podcastId])

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
              <h3 className="text-lg font-semibold">Azure AI Speech Transcription</h3>
              <p className="text-sm text-muted-foreground">
                Cloud-based transcription with high accuracy
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
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your Azure Speech API key"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Endpoint</label>
                <Input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="e.g., https://eastus.api.cognitive.microsoft.com/"
                  className="mt-1"
                />
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
        </div>
      </Card>
    </div>
  )
}
