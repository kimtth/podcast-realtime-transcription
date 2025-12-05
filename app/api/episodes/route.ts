import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || ''
  const provider = req.nextUrl.searchParams.get('provider') || 'itunes'
  if (!id) return NextResponse.json({ items: [] })
  
  if (provider === 'podcastindex') {
    const key = req.headers.get('x-podcastindex-key') || ''
    const secret = req.headers.get('x-podcastindex-secret') || ''
    if (!key || !secret) {
      return NextResponse.json({ items: [], error: 'Podcast Index key/secret required' }, { status: 400 })
    }

    // Validate Podcast Index feed ID (must be a number)
    if (!/^[0-9]+$/.test(id)) {
      return NextResponse.json({ items: [], error: 'Invalid Podcast Index feed ID' }, { status: 400 })
    }

    // Use Podcast Index feed ID
    const podcastIndexId = id

    try {
      const now = Math.floor(Date.now() / 1000)
      const auth = createHash('sha1')
        .update(`${key}${secret}${now}`)
        .digest('hex')

      // Fetch episodes directly by feed ID (simpler, working approach from test script)
      const res = await fetch(
        `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${podcastIndexId}`,
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
        console.error('Podcast Index episodes error response:', res.status, text)
        return NextResponse.json({ items: [], error: text || 'Podcast Index request failed' }, { status: res.status })
      }

      const data = await res.json()
      // console.log('Podcast Index episodes response:', { 
      //   id: podcastIndexId, 
      //   episodesCount: data.episodes?.length,
      //   items: data.items?.length,
      //   sampleKeys: data.episodes?.[0] ? Object.keys(data.episodes[0]) : (data.items?.[0] ? Object.keys(data.items[0]) : 'no data')
      // })
      
      const episodes = data.episodes || data.items || []
      const items = episodes.map((ep: any) => ({
        id: ep.guid || ep.id,
        title: ep.title,
        enclosureUrl: ep.enclosureUrl || ep.link || ep.url,
        datePublished: ep.datePublished || ep.pubDate || Math.floor(Date.now() / 1000),
        duration: ep.duration || 0,
        image: ep.image || ep.feedImage,  // Episode image or fallback to podcast feed image
        description: ep.description || ep.summary || '',
      }))

      console.log(`Podcast Index: Returning ${items.length} episodes for ID ${podcastIndexId}`)
      return NextResponse.json({ items })
    } catch (error) {
      console.error('Podcast Index episodes error:', error)
      return NextResponse.json({ items: [], error: 'Failed to fetch episodes from Podcast Index' }, { status: 500 })
    }
  }

  // Default: iTunes Lookup API (no authentication required)
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=100`,
      { headers: { 'User-Agent': 'PodcastApp/1.0' } }
    )
    const data = await res.json()
    
    // Transform iTunes response to match expected format
    const items = data.results?.slice(1)?.map((episode: any) => ({
      id: episode.episodeGuid || episode.trackId,
      title: episode.trackName,
      enclosureUrl: episode.episodeUrl,
      datePublished: new Date(episode.releaseDate).getTime() / 1000,
      duration: episode.trackTimeMillis ? episode.trackTimeMillis / 1000 : 0,
      image: episode.artworkUrl600 || episode.artworkUrl160 || episode.artworkUrl60,  // iTunes artwork
      description: episode.description,
    })) || []
    
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Episodes error:', error)
    return NextResponse.json({ items: [], error: 'Failed to fetch episodes' }, { status: 500 })
  }
}
