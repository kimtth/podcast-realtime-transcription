'use client'
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCcw, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn, formatTime } from '@/lib/utils'

interface Props {
  src: string
  onTimeUpdate: (time: number) => void
  onEnded?: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

export interface PlayerRef {
  seek: (time: number) => void
  play: () => void
  pause: () => void
  stop: () => void
  getAudioElement: () => HTMLAudioElement | null
}

const Player = forwardRef<PlayerRef, Props>(({ src, onTimeUpdate, onEnded, onPrev, onNext, hasPrev, hasNext }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time
      }
    },
    play: () => audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
    stop: () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    },
    getAudioElement: () => audioRef.current,
  }))

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      onTimeUpdate(audio.currentTime)
    }
    const handleDurationChange = () => setDuration(audio.duration || 0)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('loadedmetadata', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('loadedmetadata', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [onTimeUpdate, onEnded])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause()
    else audioRef.current?.play()
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
    }
  }

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds))
    }
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={src} crossOrigin="anonymous" preload="metadata" />
      
      {/* Progress bar */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          disabled={!hasPrev}
          className="h-10 w-10"
        >
          <SkipBack className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => skip(-15)}
          className="h-10 w-10"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="absolute text-[8px] font-bold">15</span>
        </Button>

        <Button
          variant="default"
          size="icon"
          onClick={togglePlay}
          className="h-14 w-14 rounded-full shadow-lg"
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-1" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => skip(30)}
          className="h-10 w-10"
        >
          <RotateCw className="h-4 w-4" />
          <span className="absolute text-[8px] font-bold">30</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={!hasNext}
          className="h-10 w-10"
        >
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="h-8 w-8"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={(v) => {
            setVolume(v[0])
            setIsMuted(false)
          }}
          className="w-24"
        />
      </div>
    </div>
  )
})

Player.displayName = 'Player'
export default Player
