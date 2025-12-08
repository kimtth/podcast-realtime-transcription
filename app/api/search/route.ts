import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

function getPodcastIndexAuth(key: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const hash = createHash('sha1').update(`${key}${secret}${now}`).digest('hex')
  return { 'X-Auth-Date': now.toString(), 'X-Auth-Key': key, Authorization: hash }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const provider = req.nextUrl.searchParams.get('provider') || 'itunes'
  if (!q) return NextResponse.json({ feeds: [] })

  if (provider === 'podcastindex') {
    const key = req.headers.get('x-podcastindex-key')
    const secret = req.headers.get('x-podcastindex-secret')
    if (!key || !secret) return NextResponse.json({ feeds: [], error: 'Key/secret required' }, { status: 400 })

    try {
      const auth = getPodcastIndexAuth(key, secret)
      const res = await fetch(
        `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(q)}`,
        {
          headers: {
            'User-Agent': 'PodcastApp/1.0',
            'X-User-Agent': 'PodcastApp/1.0',
            ...auth,
            Accept: 'application/json',
          },
        }
      )
      if (!res.ok) throw new Error(await res.text())

      const feeds = (await res.json()).feeds?.map((f: any) => ({
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      return NextResponse.json({ feeds: [], error: msg }, { status: 500 })
    }
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&limit=20`,
      { headers: { 'User-Agent': 'PodcastApp/1.0' } }
    )
    const feeds = (await res.json()).results?.map((f: any) => ({
      id: f.collectionId,
      title: f.collectionName,
      author: f.artistName,
      image: f.artworkUrl600 || f.artworkUrl100,
      url: f.feedUrl || f.collectionViewUrl,
      provider: 'itunes',
      iTunesId: f.collectionId,
    })) || []
    return NextResponse.json({ feeds })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ feeds: [], error: msg }, { status: 500 })
  }
}
