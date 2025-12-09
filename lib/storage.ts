import { Podcast, Episode, DownloadedEpisode, TranscriptSegment } from './types'

const STORAGE_KEY = 'podcast_subscriptions'
const DOWNLOADS_KEY = 'podcast_downloads'
const TRANSCRIPTS_KEY = 'podcast_transcripts'
const DB_NAME = 'PodcastDB'
const DB_VERSION = 1

// IndexedDB for large audio files
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('downloads')) {
        db.createObjectStore('downloads', { keyPath: 'id' })
      }
    }
  })
}

export function getSubscriptions(): Podcast[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

export function subscribe(podcast: Podcast) {
  const subs = getSubscriptions()
  // Use provider+ID as unique key to avoid duplicates across providers
  const key = `${podcast.provider || 'itunes'}:${podcast.id}`
  if (!subs.find(s => `${s.provider || 'itunes'}:${s.id}` === key)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...subs, podcast]))
  }
}

export function unsubscribe(id: number) {
  const subs = getSubscriptions().filter(s => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs))
}

export function isSubscribed(id: number): boolean {
  return getSubscriptions().some(s => s.id === id)
}

export function exportOPML(): string {
  const subs = getSubscriptions()
  const items = subs.map(s => 
    `    <outline text="${s.title}" xmlUrl="${s.url}" type="rss"/>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Podcast Subscriptions</title></head>
  <body>
${items}
  </body>
</opml>`
}

export function importOPML(xml: string): Podcast[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const outlines = doc.querySelectorAll('outline[xmlUrl]')
  const podcasts: Podcast[] = []
  outlines.forEach((o, i) => {
    podcasts.push({
      id: Date.now() + i,
      title: o.getAttribute('text') || 'Unknown',
      author: '',
      image: '',
      url: o.getAttribute('xmlUrl') || '',
    })
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(podcasts))
  return podcasts
}

// Download management
export async function downloadEpisode(episode: Episode, podcastTitle?: string, podcastImage?: string): Promise<DownloadedEpisode> {
  // Validate enclosure URL
  if (!episode.enclosureUrl) {
    throw new Error('Episode has no audio URL available for download')
  }

  // Check if URL is valid
  try {
    new URL(episode.enclosureUrl)
  } catch {
    throw new Error(`Invalid episode URL: ${episode.enclosureUrl}`)
  }

  console.log(`Downloading episode: ${episode.title}`)
  console.log(`Original URL: ${episode.enclosureUrl}`)

  // Use proxy to bypass CORS restrictions
  const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(episode.enclosureUrl)}`
  console.log(`Downloading via proxy...`)

  let response: Response
  try {
    response = await fetch(proxyUrl, {
      cache: 'default',
    })
  } catch (fetchError) {
    console.error('Fetch error:', fetchError)
    throw new Error(`Failed to download episode: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`)
  }

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}: ${response.statusText}`)
  }

  const blob = await response.blob()
  
  if (blob.size === 0) {
    throw new Error('Downloaded file is empty')
  }

  console.log(`Downloaded ${(blob.size / 1024 / 1024).toFixed(2)} MB`)
  
  const downloaded: DownloadedEpisode = {
    ...episode,
    podcastTitle,
    podcastImage, // Store podcast image as fallback
    blob,
    downloadedAt: Date.now(),
  }
  
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('downloads', 'readwrite')
    const store = tx.objectStore('downloads')
    const request = store.put(downloaded)
    request.onsuccess = () => {
      updateDownloadsMeta(episode.id, { ...episode, podcastTitle, downloadedAt: downloaded.downloadedAt })
      resolve(downloaded)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getDownloadedEpisode(id: number | string): Promise<DownloadedEpisode | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('downloads', 'readonly')
    const store = tx.objectStore('downloads')
    const request = store.get(id)
    request.onsuccess = () => {
      const result = request.result
      console.log(`Retrieved download for ID ${id}:`, result ? 'Found' : 'Not found')
      resolve(result || null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function deleteDownload(id: number | string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('downloads', 'readwrite')
    const store = tx.objectStore('downloads')
    const request = store.delete(id)
    request.onsuccess = () => {
      removeDownloadMeta(id)
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}

export function getDownloadsMeta(): Record<string | number, { title: string; podcastTitle?: string; downloadedAt: number }> {
  if (typeof window === 'undefined') return {}
  const data = localStorage.getItem(DOWNLOADS_KEY)
  return data ? JSON.parse(data) : {}
}

function updateDownloadsMeta(id: number | string, episode: Episode & { podcastTitle?: string; downloadedAt: number }) {
  const meta = getDownloadsMeta()
  meta[id] = { title: episode.title, podcastTitle: episode.podcastTitle, downloadedAt: episode.downloadedAt }
  localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(meta))
}

function removeDownloadMeta(id: number | string) {
  const meta = getDownloadsMeta()
  delete meta[id]
  localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(meta))
}

export function isDownloaded(id: number | string): boolean {
  return id in getDownloadsMeta()
}

export async function getAllDownloads(): Promise<DownloadedEpisode[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('downloads', 'readonly')
    const store = tx.objectStore('downloads')
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// Transcript storage (engine-specific)
export interface StoredTranscript {
  episodeId: number | string
  podcastId: number
  engine: 'azure' | 'fasterwhisper'
  segments: TranscriptSegment[]
  createdAt: number
}

function getTranscripts(): Record<string, StoredTranscript> {
  if (typeof window === 'undefined') return {}
  const data = localStorage.getItem(TRANSCRIPTS_KEY)
  return data ? JSON.parse(data) : {}
}


export function saveTranscript(episodeId: number | string, podcastId: number, engine: 'azure' | 'fasterwhisper', segments: TranscriptSegment[]): void {
  if (typeof window === 'undefined') return
  const transcripts = getTranscripts()
  const key = `${episodeId}-${engine}`
  transcripts[key] = {
    episodeId,
    podcastId,
    engine,
    segments,
    createdAt: Date.now(),
  }
  localStorage.setItem(TRANSCRIPTS_KEY, JSON.stringify(transcripts))
}

export function getTranscript(episodeId: number | string, engine: 'azure' | 'fasterwhisper'): TranscriptSegment[] | null {
  if (typeof window === 'undefined') return null
  const transcripts = getTranscripts()
  const key = `${episodeId}-${engine}`
  return transcripts[key]?.segments || null
}

export function getAvailableTranscripts(episodeId: number | string): ('azure' | 'fasterwhisper')[] {
  if (typeof window === 'undefined') return []
  const transcripts = getTranscripts()
  const engines: ('azure' | 'fasterwhisper')[] = []
  for (const key in transcripts) {
    if (transcripts[key].episodeId === episodeId) {
      engines.push(transcripts[key].engine)
    }
  }
  return engines
}

export function deleteTranscript(episodeId: number | string, engine: 'azure' | 'fasterwhisper'): void {
  if (typeof window === 'undefined') return
  const transcripts = getTranscripts()
  const key = `${episodeId}-${engine}`
  delete transcripts[key]
  localStorage.setItem(TRANSCRIPTS_KEY, JSON.stringify(transcripts))
}

// Useful expressions storage
const EXPRESSIONS_KEY = 'podcast_useful_expressions'

interface UsefulExpression {
  phrase: string
  meaning: string
  example: string
}

export function saveExpressions(expressions: UsefulExpression[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(EXPRESSIONS_KEY, JSON.stringify(expressions))
}

export function getExpressions(): UsefulExpression[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(EXPRESSIONS_KEY)
  return data ? JSON.parse(data) : []
}

export function clearExpressions(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(EXPRESSIONS_KEY)
}

