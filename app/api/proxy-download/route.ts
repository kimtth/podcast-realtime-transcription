import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 })
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url)
    
    // Fetch the file from the external URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PodcastApp/1.0',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const contentLength = response.headers.get('content-length')

    // Stream the response
    const headers = new Headers({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    })

    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    return new NextResponse(response.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Proxy download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    )
  }
}
