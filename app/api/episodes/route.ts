import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

function getPodcastIndexAuth(key: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const hash = createHash('sha1').update(`${key}${secret}${now}`).digest('hex')
  return { 'X-Auth-Date': now.toString(), 'X-Auth-Key': key, Authorization: hash }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || ''
  const provider = req.nextUrl.searchParams.get('provider') || 'itunes'
  if (!id) return NextResponse.json({ items: [] })

  if (provider === 'podcastindex') {
    const key = req.headers.get('x-podcastindex-key')
    const secret = req.headers.get('x-podcastindex-secret')
    if (!key || !secret) return NextResponse.json({ items: [], error: 'Key/secret required' }, { status: 400 })
    if (!/^[0-9]+$/.test(id)) return NextResponse.json({ items: [], error: 'Invalid feed ID' }, { status: 400 })

    try {
      const auth = getPodcastIndexAuth(key, secret)
      const res = await fetch(
        `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${id}`,
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

      const eps = (await res.json()).episodes || []
      const items = eps.map((ep: any) => ({
        id: ep.guid || ep.id,
        title: ep.title,
        enclosureUrl: ep.enclosureUrl || ep.link,
        datePublished: ep.datePublished || Math.floor(Date.now() / 1000),
        duration: ep.duration || 0,
        image: ep.image || ep.feedImage,
        description: ep.description || ep.summary || '',
      }))
      return NextResponse.json({ items })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch'
      return NextResponse.json({ items: [], error: msg }, { status: 500 })
    }
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=100`,
      { headers: { 'User-Agent': 'PodcastApp/1.0' } }
    )
    const items = (await res.json()).results?.slice(1)?.map((ep: any) => ({
      id: ep.episodeGuid || ep.trackId,
      title: ep.trackName,
      enclosureUrl: ep.episodeUrl,
      datePublished: new Date(ep.releaseDate).getTime() / 1000,
      duration: ep.trackTimeMillis ? ep.trackTimeMillis / 1000 : 0,
      image: ep.artworkUrl600 || ep.artworkUrl160,
      description: ep.description,
    })) || []
    return NextResponse.json({ items })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch'
    return NextResponse.json({ items: [], error: msg }, { status: 500 })
  }
}
