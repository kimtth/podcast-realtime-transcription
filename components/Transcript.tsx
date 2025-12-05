'use client'
import { Mic, FileText } from 'lucide-react'
import { TranscriptSegment } from '@/lib/types'
import { cn, formatTime } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  segments: TranscriptSegment[]
  currentTime: number
  onSeek: (time: number) => void
}

export default function Transcript({ segments, currentTime, onSeek }: Props) {
  return (
    <ScrollArea className="flex-1 bg-muted/30">
      {segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Mic className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Waiting for transcription...</h3>
          <p className="text-sm text-muted-foreground">Play the audio to start live transcription</p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{segments.length} segments transcribed</span>
          </div>
          {segments.map((seg, i) => {
            // Find the currently playing segment with a small tolerance (0.5s)
            const TOLERANCE = 0.5
            const nextSegment = segments[i + 1]
            
            // Check if current time is within this segment's range (with tolerance)
            const isActive = currentTime >= (seg.time - TOLERANCE) && 
              (!nextSegment || currentTime < (nextSegment.time - TOLERANCE))
            
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSeek(seg.time)}
                className={cn(
                  "w-full text-left p-3 rounded-lg cursor-pointer transition-all duration-200 border-0",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" 
                    : "bg-card hover:bg-accent hover:shadow-sm"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "text-xs font-mono px-2 py-0.5 rounded-md flex-shrink-0",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {formatTime(seg.time)}
                  </span>
                  <p className={cn("text-sm leading-relaxed", isActive ? "text-primary-foreground" : "text-foreground")}>
                    {seg.text}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </ScrollArea>
  )
}
