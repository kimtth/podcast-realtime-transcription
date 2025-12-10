'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Maximize2, Download } from 'lucide-react'

interface Segment {
  start: number
  end: number
  text: string
  isFinal: boolean
}

interface UsefulExpression {
  phrase: string
  meaning: string
  example: string
}

interface TranscriptSegmentListProps {
  segments: Segment[]
  onSeek?: (time: number) => void
  compact?: boolean
  usefulExpressions?: UsefulExpression[]
  onDialogOpenChange?: (open: boolean) => void
}

export default function TranscriptSegmentList({ segments, onSeek, compact = true, usefulExpressions = [], onDialogOpenChange }: TranscriptSegmentListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    onDialogOpenChange?.(open)
  }

  const exportExpressions = () => {
    if (usefulExpressions.length === 0) return
    
    const csvContent = usefulExpressions
      .map((expr) => `"${expr.phrase}","${expr.meaning}","${expr.example}"`)
      .join('\n')
    
    const header = '"Phrase","Meaning","Example"\n'
    const fullContent = header + csvContent
    
    const blob = new Blob([fullContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expressions-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const SegmentItems = ({ inDialog = false }: { inDialog?: boolean }) => (
    <div className="space-y-2">
      {segments.map((seg, idx) => {
        // console.log(`[TranscriptSegmentList] Segment ${idx}: start=${seg.start}s, text="${seg.text.substring(0, 50)}"`)
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
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{segments.length} segments</span>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <Maximize2 className="w-4 h-4 mr-2" />
              Expand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Transcript & Learning Resources</DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {usefulExpressions && usefulExpressions.length > 0 && (
                <div className="flex gap-4">
                  {/* Expressions Section */}
                  <div className="flex-1 border rounded-lg">
                    <div className="px-4 py-3 text-sm font-medium border-b bg-amber-50/50">
                      💡 Useful Expressions for Learning ({usefulExpressions.length})
                    </div>
                    <ScrollArea className="max-h-64">
                      <div className="p-4 space-y-3">
                        {usefulExpressions.map((expr, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-amber-400 pl-3 bg-amber-50/30 rounded p-2">
                            <div className="font-semibold text-foreground">{expr.phrase}</div>
                            <div className="text-xs text-muted-foreground mt-1">📌 {expr.meaning}</div>
                            <div className="text-xs italic text-muted-foreground mt-2 bg-amber-100/50 p-2 rounded">
                              ✏️ {expr.example}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Export Button */}
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={exportExpressions}
                      variant="outline"
                      className="h-10"
                      title="Export expressions as CSV"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex-1 flex flex-col border rounded-lg min-h-0">
                <div className="px-4 py-3 text-sm font-medium border-b">
                  Transcript ({segments.length} segments)
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4">
                    <SegmentItems inDialog />
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
