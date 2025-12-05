import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}
// Split long transcription text into sentence-based segments for navigation
export function splitTranscriptionIntoSegments(text: string, totalDurationMs: number, targetSegmentCount: number = 5): Array<{start: number; end: number; text: string}> {
  if (!text || text.length === 0) return []
  
  // Split by sentence (. ! ?)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  
  // If we have few sentences, return as single segment
  if (sentences.length <= 1) {
    return [{
      start: 0,
      end: totalDurationMs / 1000,
      text: text.trim()
    }]
  }
  
  // Group sentences into segments based on target count
  const sentencesPerSegment = Math.ceil(sentences.length / Math.min(targetSegmentCount, sentences.length))
  const segments = []
  const timePerSegment = (totalDurationMs / 1000) / Math.ceil(sentences.length / sentencesPerSegment)
  
  for (let i = 0; i < sentences.length; i += sentencesPerSegment) {
    const segmentText = sentences
      .slice(i, i + sentencesPerSegment)
      .join('')
      .trim()
    
    if (segmentText) {
      segments.push({
        start: (i / sentences.length) * (totalDurationMs / 1000),
        end: Math.min((i + sentencesPerSegment) / sentences.length * (totalDurationMs / 1000), totalDurationMs / 1000),
        text: segmentText
      })
    }
  }
  
  return segments.length > 0 ? segments : [{
    start: 0,
    end: totalDurationMs / 1000,
    text: text
  }]
}
