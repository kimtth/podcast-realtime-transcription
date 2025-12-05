import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const provider = req.nextUrl.searchParams.get('provider') || 'itunes'
  if (!q) return NextResponse.json({ feeds: [] })

  if (provider === 'podcastindex') {
    const key = req.headers.get('x-podcastindex-key') || ''
    const secret = req.headers.get('x-podcastindex-secret') || ''
    if (!key || !secret) {
      return NextResponse.json({ feeds: [], error: 'Podcast Index key/secret required' }, { status: 400 })
    }

    try {
      const now = Math.floor(Date.now() / 1000)
      // Podcast Index expects SHA1(key + secret + timestamp) (not HMAC)
      const auth = createHash('sha1')
        .update(`${key}${secret}${now}`)
        .digest('hex')

      const res = await fetch(
        `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(q)}`,
        {
          headers: {
            'User-Agent': 'PodcastApp/1.0',
            'X-User-Agent': 'PodcastApp/1.0',
            'X-Auth-Date': now.toString(),
            'X-Auth-Key': key,
            Authorization: auth,
            Accept: 'application/json',
          },
        }
      )

      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ feeds: [], error: text || 'Podcast Index search failed' }, { status: res.status })
      }

      const data = await res.json()
      const feeds = data.feeds?.map((f: any) => ({
        id: f.id,
        title: f.title,
        author: f.author,
        image: f.image,
        url: f.url,
        feedUrl: f.feedUrl || f.url,
        provider: 'podcastindex',
        podcastIndexId: f.id,
      })) || []
      return NextResponse.json({ feeds })
    } catch (error) {
      console.error('Podcast Index search error:', error)
      return NextResponse.json({ feeds: [], error: 'Podcast Index search failed' }, { status: 500 })
    }
  }

  // Default: iTunes Search API (no auth required)
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&limit=20`,
      { headers: { 'User-Agent': 'PodcastApp/1.0' } }
    )
    const data = await res.json()

    const feeds = data.results?.map((item: any) => ({
      id: item.collectionId,
      title: item.collectionName,
      author: item.artistName,
      image: item.artworkUrl600 || item.artworkUrl100,
      url: item.feedUrl || item.collectionViewUrl,
      provider: 'itunes',
      iTunesId: item.collectionId,
    })) || []

    return NextResponse.json({ feeds })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ feeds: [], error: 'Search failed' }, { status: 500 })
  }
}
