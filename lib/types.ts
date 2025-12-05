export interface Podcast {
  id: number | string
  title: string
  author: string
  image: string
  url: string
  feedUrl?: string
  provider?: 'itunes' | 'podcastindex' // Track which provider this ID belongs to
  iTunesId?: number | string // iTunes collectionId
  podcastIndexId?: number | string // Podcast Index feedId
}

export interface Episode {
  id: number | string  // Support both iTunes numeric IDs and Podcast Index string GUIDs
  title: string
  enclosureUrl: string
  datePublished: number
  duration: number
  image?: string  // Episode or podcast cover image
  podcastId?: number
  podcastTitle?: string
}

export interface DownloadedEpisode extends Episode {
  blob: Blob
  downloadedAt: number
  localUrl?: string
  podcastImage?: string  // Fallback image from podcast
}

export interface TranscriptSegment {
  text: string
  time: number
}
