'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Search, Play, Pause, ChevronLeft, Mic, Radio, Clock, Calendar, 
  Download, Upload, Heart, MoreHorizontal, Volume2, SkipBack, SkipForward,
  Headphones, ListMusic, Settings2, Sparkles, Loader2, Trash2, HardDrive,
  Check, X
} from 'lucide-react'
import Player, { PlayerRef } from '@/components/Player'
import Transcript from '@/components/Transcript'
import AzureSpeechTranscriber from '@/components/AzureSpeechTranscriber'
import FasterWhisperTranscriber from '@/components/FasterWhisperTranscriber'
import Settings from '@/components/Settings'
import { Podcast, Episode, TranscriptSegment, DownloadedEpisode } from '@/lib/types'
import { 
  getSubscriptions, subscribe, unsubscribe, isSubscribed, exportOPML, importOPML,
  downloadEpisode, deleteDownload, isDownloaded, getAllDownloads, getDownloadedEpisode,
  saveTranscript, getTranscript
} from '@/lib/storage'
import { getSettings, addToListeningHistory, getLastPlayedEpisode } from '@/lib/appSettings'
import { cn, formatDate, formatDuration } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

// Helper to convert podcast ID to number for storage functions
const getPodcastIdAsNumber = (id: string | number | undefined): number => {
  if (typeof id === 'number') return id
  if (typeof id === 'string') return parseInt(id, 10) || 0
  return 0
}

export default function Home() {
  const appSettings = getSettings()
  const [view, setView] = useState<'search' | 'subs' | 'episodes' | 'player' | 'downloads'>('subs')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Podcast[]>([])
  const [subs, setSubs] = useState<Podcast[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [downloads, setDownloads] = useState<DownloadedEpisode[]>([])
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null)
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(-1)
  const [playlist, setPlaylist] = useState<Episode[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [transcribing, setTranscribing] = useState(appSettings.enableTranscription)
  const [transcriptionEngine, setTranscriptionEngine] = useState<'azure' | 'fasterwhisper'>(appSettings.transcriptionEngine)
  const [searchProvider, setSearchProvider] = useState<'itunes' | 'podcastindex'>(appSettings.searchProvider || 'itunes')
  const [podcastIndexKey, setPodcastIndexKey] = useState(appSettings.podcastIndexKey || '')
  const [podcastIndexSecret, setPodcastIndexSecret] = useState(appSettings.podcastIndexSecret || '')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<number | string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const playerRef = useRef<PlayerRef>(null)

  useEffect(() => { 
    setSubs(getSubscriptions())
    loadDownloads()
  }, [])

  useEffect(() => {
    // Save listening history when currentTime changes (every 10 seconds)
    if (currentEpisode && currentTime % 10 < 1 && appSettings.autoResume) {
      addToListeningHistory(currentEpisode.id, getPodcastIdAsNumber(currentPodcast?.id), currentTime)
    }
  }, [currentTime, currentEpisode, currentPodcast, appSettings.autoResume])

  useEffect(() => {
    if (currentEpisode) {
      const saved = getTranscript(currentEpisode.id, transcriptionEngine)
      if (saved) {
        setSegments(saved)
      } else {
        setSegments([])
      }
    } else {
      setSegments([])
    }
  }, [currentEpisode, transcriptionEngine])

  const loadDownloads = async () => {
    const dl = await getAllDownloads()
    setDownloads(dl)
  }

  useEffect(() => {
    // Update settings when they change
    const updatedSettings = getSettings()
    setTranscribing(updatedSettings.enableTranscription)
    setTranscriptionEngine(updatedSettings.transcriptionEngine)
    setSearchProvider(updatedSettings.searchProvider || 'itunes')
    setPodcastIndexKey(updatedSettings.podcastIndexKey || '')
    setPodcastIndexSecret(updatedSettings.podcastIndexSecret || '')
    
    // Apply color theme
    applyColorTheme(updatedSettings.accentColor)
  }, [showSettings])

  const applyColorTheme = (color: 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'pink' | 'indigo' | 'cyan') => {
    const root = document.documentElement
    const colorMap = {
      purple: { h: 270, s: 93, l: 67 },
      blue: { h: 217, s: 91, l: 60 },
      green: { h: 160, s: 84, l: 39 },
      red: { h: 0, s: 84, l: 60 },
      orange: { h: 25, s: 95, l: 53 },
      pink: { h: 332, s: 83, l: 60 },
      indigo: { h: 226, s: 97, l: 56 },
      cyan: { h: 188, s: 94, l: 51 },
    }
    const hsl = colorMap[color]
    root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`)
  }

  const search = async () => {
    if (!query.trim()) return
    const provider = searchProvider === 'podcastindex' && podcastIndexKey && podcastIndexSecret
      ? 'podcastindex'
      : 'itunes'
    if (provider === 'podcastindex' && (!podcastIndexKey || !podcastIndexSecret)) {
      alert('Add your Podcast Index key and secret in Settings.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&provider=${provider}` , {
        headers: provider === 'podcastindex'
          ? {
              'x-podcastindex-key': podcastIndexKey,
              'x-podcastindex-secret': podcastIndexSecret,
            }
          : undefined,
      })
      const data = await res.json()
      setResults(data.feeds?.map((f: any) => ({
        id: f.id, title: f.title, author: f.author, image: f.image, url: f.url, feedUrl: f.feedUrl, provider: f.provider, iTunesId: f.iTunesId, podcastIndexId: f.podcastIndexId
      })) || [])
      setView('search')
    } finally {
      setLoading(false)
    }
  }

  const loadEpisodes = async (podcast: Podcast) => {
    setCurrentPodcast(podcast)
    setLoading(true)
    try {
      // Use the stored provider, or detect from search settings
      const podcastProvider = podcast.provider || (searchProvider === 'podcastindex' && podcastIndexKey && podcastIndexSecret ? 'podcastindex' : 'itunes')
      const episodeRequestId = podcastProvider === 'podcastindex' ? (podcast.podcastIndexId || podcast.id) : podcast.id
      
      const res = await fetch(`/api/episodes?id=${episodeRequestId}&provider=${podcastProvider}`, {
        headers: podcastProvider === 'podcastindex'
          ? {
              'x-podcastindex-key': podcastIndexKey,
              'x-podcastindex-secret': podcastIndexSecret,
            }
          : undefined,
      })
      const data = await res.json()
      setEpisodes(data.items?.map((e: any) => ({
        id: e.id, title: e.title, enclosureUrl: e.enclosureUrl,
        datePublished: e.datePublished, duration: e.duration, image: e.image
      })) || [])
      setView('episodes')
    } finally {
      setLoading(false)
    }
  }

  const playEpisode = (episode: Episode, episodeList?: Episode[]) => {
    setCurrentEpisode(episode)
    setSegments([])
    setCurrentTime(0)
    if (episodeList) {
      setPlaylist(episodeList)
      setCurrentEpisodeIndex(episodeList.findIndex(e => e.id === episode.id))
    }
    setView('player')
  }

  const playNext = () => {
    if (currentEpisodeIndex < playlist.length - 1) {
      const nextEp = playlist[currentEpisodeIndex + 1]
      setCurrentEpisode(nextEp)
      setCurrentEpisodeIndex(currentEpisodeIndex + 1)
      setSegments([])
      setCurrentTime(0)
    }
  }

  const playPrev = () => {
    if (currentEpisodeIndex > 0) {
      const prevEp = playlist[currentEpisodeIndex - 1]
      setCurrentEpisode(prevEp)
      setCurrentEpisodeIndex(currentEpisodeIndex - 1)
      setSegments([])
      setCurrentTime(0)
    }
  }

  const handleDownload = async (episode: Episode) => {
    setDownloading(episode.id)
    try {
      await downloadEpisode(episode, currentPodcast?.title, currentPodcast?.image)
      await loadDownloads()
    } catch (error) {
      console.error('Download failed:', error)
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDownloading(null)
    }
  }

  const handleDeleteDownload = async (id: number | string) => {
    await deleteDownload(id)
    await loadDownloads()
  }

  const playDownloaded = async (episode: DownloadedEpisode) => {
    const dl = await getDownloadedEpisode(episode.id)
    if (dl?.blob) {
      const url = URL.createObjectURL(dl.blob)
      // Use dl (from database) instead of episode (from state) to ensure we have fresh data including image
      setCurrentEpisode({ ...dl, enclosureUrl: url })
      
      // Get the best available image: episode image > podcast image > empty
      const displayImage = dl.image || dl.podcastImage || ''
      
      // Set minimal podcast info using the fresh data from database
      if (dl.podcastTitle) {
        setCurrentPodcast({
          id: 0,
          title: dl.podcastTitle,
          author: '',
          image: displayImage,
          url: '',
        })
      } else {
        setCurrentPodcast(null) // Clear podcast so episode image is used
      }
      
      setPlaylist(downloads)
      setCurrentEpisodeIndex(downloads.findIndex(d => d.id === dl.id))
      setSegments([])
      setCurrentTime(0)
      setView('player')
    }
  }

  const handleSubscribe = (podcast: Podcast) => {
    const id = getPodcastIdAsNumber(podcast.id)
    if (isSubscribed(id)) unsubscribe(id)
    else subscribe(podcast) // Subscribe with full podcast object including provider info
    setSubs(getSubscriptions())
  }

  const handleExport = () => {
    const opml = exportOPML()
    const blob = new Blob([opml], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subscriptions.opml'
    a.click()
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setSubs(importOPML(reader.result as string))
      reader.readAsText(file)
    }
  }

  const addSegment = useCallback((segment: TranscriptSegment) => {
    setSegments(prev => [...prev, segment])
  }, [])

  const PodcastCard = ({ podcast, showSub = true }: { podcast: Podcast; showSub?: boolean }) => (
    <Card 
      className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-0 bg-gradient-to-br from-card to-muted/30"
      onClick={() => loadEpisodes(podcast)}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="relative">
            {podcast.image ? (
              <img src={podcast.image} alt="" className="w-20 h-20 rounded-xl object-cover shadow-md group-hover:shadow-xl transition-shadow" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                <Headphones className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-3 h-3 text-primary-foreground ml-0.5" />
            </div>
          </div>
          <div className="flex-1 min-w-0 py-1">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{podcast.title}</h3>
            <p className="text-sm text-muted-foreground truncate mt-1">{podcast.author || 'Unknown author'}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                <Radio className="w-3 h-3 mr-1" /> Podcast
              </Badge>
            </div>
          </div>
          {showSub && (
            <Button
              variant={isSubscribed(getPodcastIdAsNumber(podcast.id)) ? "outline" : "default"}
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleSubscribe(podcast) }}
              className="self-center"
            >
              <Heart className={cn("w-4 h-4 mr-1", isSubscribed(getPodcastIdAsNumber(podcast.id)) && "fill-current text-red-500")} />
              {isSubscribed(getPodcastIdAsNumber(podcast.id)) ? 'Saved' : 'Save'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const EpisodeCard = ({ episode }: { episode: Episode }) => (
    <Card 
      className="group cursor-pointer hover:shadow-md transition-all duration-200 border-0 bg-card/50 hover:bg-card"
      onClick={() => playEpisode(episode, episodes)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm">
            <Play className="w-5 h-5 ml-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {episode.title}
            </h3>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(episode.datePublished)}
              </span>
              {episode.duration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(episode.duration)}
                </span>
              )}
              {isDownloaded(episode.id) && (
                <Badge variant="success" className="text-xs">
                  <Check className="w-3 h-3 mr-1" /> Downloaded
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {downloading === episode.id ? (
              <Button variant="ghost" size="icon" disabled>
                <Loader2 className="w-4 h-4 animate-spin" />
              </Button>
            ) : isDownloaded(episode.id) ? (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => { e.stopPropagation(); handleDeleteDownload(episode.id) }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => { e.stopPropagation(); handleDownload(episode) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const DownloadCard = ({ episode }: { episode: DownloadedEpisode }) => (
    <Card 
      className="group cursor-pointer hover:shadow-md transition-all duration-200 border-0 bg-card/50 hover:bg-card"
      onClick={() => playDownloaded(episode)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {episode.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{episode.podcastTitle}</p>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                {formatDate(Math.floor(episode.downloadedAt / 1000))}
              </span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => { e.stopPropagation(); handleDeleteDownload(episode.id) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  const LoadingSkeleton = () => (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="border-0">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <Skeleton className="w-20 h-20 rounded-xl" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const EmptyState = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm">{description}</p>
    </div>
  )

  return (
    <main className="flex flex-col h-screen max-w-3xl mx-auto bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-lg">Podcast Player</h1>
              <p className="text-xs text-muted-foreground">with Live Transcription</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="rounded-xl"
            >
              <Settings2 className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search for podcasts..."
              className="pl-10 pr-20 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-2"
            />
            <Button 
              onClick={search} 
              disabled={loading}
              size="sm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          <Tabs value={view === 'search' ? 'search' : view === 'downloads' ? 'downloads' : view === 'player' ? 'nowplaying' : 'library'} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-11">
              <TabsTrigger value="library" onClick={() => setView('subs')} className="data-[state=active]:bg-background">
                <ListMusic className="w-4 h-4 mr-2" /> Library
              </TabsTrigger>
              <TabsTrigger value="downloads" onClick={() => setView('downloads')} className="data-[state=active]:bg-background">
                <HardDrive className="w-4 h-4 mr-2" /> Downloads
                {downloads.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">{downloads.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="nowplaying" 
                onClick={() => currentEpisode && setView('player')}
                disabled={!currentEpisode}
                className="data-[state=active]:bg-background"
              >
                {currentEpisode && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />}
                <Volume2 className="w-4 h-4 mr-2" /> Playing
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading && <LoadingSkeleton />}

        {!loading && view === 'search' && (
          <div className="p-4 space-y-3">
            {results.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground px-1">{results.length} results found</p>
                {results.map(p => <PodcastCard key={p.id} podcast={p} />)}
              </>
            ) : (
              <EmptyState icon={Search} title="No results found" description="Try searching with different keywords" />
            )}
          </div>
        )}

        {!loading && view === 'subs' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Your Library</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" /> Export
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" /> Import
                    <input type="file" accept=".opml,.xml" onChange={handleImport} className="hidden" />
                  </label>
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {subs.length > 0 ? (
                subs.map(p => <PodcastCard key={p.id} podcast={p} showSub={false} />)
              ) : (
                <EmptyState icon={Headphones} title="No subscriptions yet" description="Search for podcasts and save your favorites" />
              )}
            </div>
          </div>
        )}

        {!loading && view === 'downloads' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Downloads</h2>
              <Badge variant="secondary">{downloads.length} episodes</Badge>
            </div>
            <div className="space-y-3">
              {downloads.length > 0 ? (
                downloads.map(ep => <DownloadCard key={ep.id} episode={ep} />)
              ) : (
                <EmptyState icon={HardDrive} title="No downloads yet" description="Download episodes to listen offline" />
              )}
            </div>
          </div>
        )}

        {!loading && view === 'episodes' && currentPodcast && (
          <div className="p-4">
            <Button variant="ghost" size="sm" onClick={() => setView('subs')} className="mb-4 -ml-2">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            
            <Card className="mb-6 border-0 bg-gradient-to-br from-card to-muted/30 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex gap-5">
                  {currentPodcast.image ? (
                    <img src={currentPodcast.image} alt="" className="w-28 h-28 rounded-2xl object-cover shadow-xl" />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl">
                      <Headphones className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 py-1">
                    <h2 className="text-2xl font-bold text-foreground">{currentPodcast.title}</h2>
                    <p className="text-muted-foreground mt-1">{currentPodcast.author}</p>
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant={isSubscribed(getPodcastIdAsNumber(currentPodcast.id)) ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleSubscribe(currentPodcast)}
                      >
                        <Heart className={cn("w-4 h-4 mr-2", isSubscribed(getPodcastIdAsNumber(currentPodcast.id)) && "fill-current text-red-500")} />
                        {isSubscribed(getPodcastIdAsNumber(currentPodcast.id)) ? 'Saved' : 'Save to Library'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Episodes</h3>
              <Badge variant="secondary">{episodes.length} episodes</Badge>
            </div>
            <div className="space-y-2">
              {episodes.map(ep => <EpisodeCard key={ep.id} episode={ep} />)}
            </div>
          </div>
        )}

        {!loading && view === 'player' && currentEpisode && (
          <div className="flex flex-col h-full">
            <div className="p-4 bg-gradient-to-b from-muted/50 to-background">
              <Button variant="ghost" size="sm" onClick={() => setView('episodes')} className="-ml-2 mb-4">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              
              <div className="flex items-start gap-4 mb-6">
                {(currentEpisode.image || currentPodcast?.image) ? (
                  <img src={currentEpisode.image || currentPodcast?.image} alt="" className="w-24 h-24 rounded-xl object-cover shadow-lg" />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Headphones className="w-10 h-10 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary" className="mb-2">Now Playing</Badge>
                  <h2 className="text-lg font-bold text-foreground line-clamp-2">{currentEpisode.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{currentPodcast?.title}</p>
                </div>
              </div>

              <Player 
                ref={playerRef} 
                src={currentEpisode.enclosureUrl} 
                onTimeUpdate={setCurrentTime}
                onEnded={playNext}
                onPrev={playPrev}
                onNext={playNext}
                hasPrev={currentEpisodeIndex > 0}
                hasNext={currentEpisodeIndex < playlist.length - 1}
              />
              
              <Card className="mt-4 border-0 bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Live Transcription</span>
                      </div>
                      <Switch checked={transcribing} onCheckedChange={setTranscribing} />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSettings(true)}
                      className="gap-2"
                    >
                      <Settings2 className="w-4 h-4" />
                      <span className="text-xs">Settings</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {transcribing && transcriptionEngine === 'azure' && (
              <AzureSpeechTranscriber
                audioUrl={currentEpisode?.enclosureUrl || ''}
                episodeId={currentEpisode?.id}
                podcastId={typeof currentPodcast?.id === 'number' ? currentPodcast.id : currentPodcast?.id ? parseInt(String(currentPodcast.id)) : undefined}
                onTranscriptUpdate={(newSegments) => {
                  const mapped = newSegments.map(s => ({ time: s.start, text: s.text }))
                  setSegments(mapped)
                  if (currentEpisode && currentPodcast) {
                    saveTranscript(currentEpisode.id, getPodcastIdAsNumber(currentPodcast.id), 'azure', mapped)
                  }
                }}
              />
            )}

            {transcribing && transcriptionEngine === 'fasterwhisper' && (
              <FasterWhisperTranscriber
                audioUrl={currentEpisode?.enclosureUrl || ''}
                onTranscriptUpdate={(newSegments) => {
                  const mapped = newSegments.map(s => ({ time: s.start, text: s.text }))
                  setSegments(mapped)
                  if (currentEpisode && currentPodcast) {
                    saveTranscript(currentEpisode.id, getPodcastIdAsNumber(currentPodcast.id), 'fasterwhisper', mapped)
                  }
                }}
              />
            )}
            
            <Transcript 
              segments={segments} 
              currentTime={currentTime} 
              onSeek={(t) => {
                console.log('Seeking to:', t, 'playerRef:', playerRef.current)
                if (playerRef.current) {
                  playerRef.current.seek(t)
                } else {
                  console.warn('Player ref not available')
                }
              }} 
            />
          </div>
        )}
      </ScrollArea>
      
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </main>
  )
}
