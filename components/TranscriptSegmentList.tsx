'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Maximize2 } from 'lucide-react'

interface Segment {
  start: number
  end: number
  text: string
  isFinal: boolean
}

interface TranscriptSegmentListProps {
  segments: Segment[]
  onSeek?: (time: number) => void
  compact?: boolean
}

export default function TranscriptSegmentList({ segments, onSeek, compact = true }: TranscriptSegmentListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const SegmentItems = ({ inDialog = false }: { inDialog?: boolean }) => (
    <div className="space-y-2">
      {segments.map((seg, idx) => {
        console.log(`[TranscriptSegmentList] Segment ${idx}: start=${seg.start}s, text="${seg.text.substring(0, 50)}"`)
        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              console.log(`[TranscriptSegmentList] Seeking to ${seg.start}s for segment: "${seg.text.substring(0, 50)}"`)
              onSeek?.(seg.start)
              if (inDialog) setDialogOpen(false)
            }}
            className="w-full text-left text-sm p-2 rounded hover:bg-muted transition"
          >
            <span className="font-mono text-xs text-muted-foreground mr-2">
              {new Date(seg.start * 1000).toISOString().substr(11, 8)}
            </span>
            <span>{seg.text}</span>
          </button>
        )
      })}
    </div>
  )

  if (segments.length === 0) return null

  return (
    <>
      {compact && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{segments.length} segments</span>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Expand
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Full Transcript</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 border rounded-lg p-4">
                  <SegmentItems inDialog />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
          <ScrollArea className="h-64 border rounded-lg p-4">
            <SegmentItems />
          </ScrollArea>
        </>
      )}
    </>
  )
}
