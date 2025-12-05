import { createHash } from 'crypto'

const key = process.env.PI_KEY || ''
const secret = process.env.PI_SECRET || ''

if (!key || !secret) {
  console.error('❌ Missing PI_KEY or PI_SECRET environment variables')
  console.error('Usage: PI_KEY=your-key PI_SECRET=your-secret node test-podcastindex.mjs')
  process.exit(1)
}

// Helper to generate auth headers
function getAuthHeaders() {
  const ts = Math.floor(Date.now() / 1000)
  const auth = createHash('sha1')
    .update(`${key}${secret}${ts}`)
    .digest('hex')
  
  return {
    'User-Agent': 'PodcastApp/1.0',
    'X-User-Agent': 'PodcastApp/1.0',
    'X-Auth-Date': ts.toString(),
    'X-Auth-Key': key,
    'Authorization': auth,
    'Accept': 'application/json',
  }
}

// Helper to make API calls
async function apiCall(endpoint, name) {
  console.log(`\n📡 Testing: ${name}`)
  console.log(`URL: ${endpoint}`)
  
  try {
    const res = await fetch(endpoint, { headers: getAuthHeaders() })
    console.log(`Status: ${res.status} ${res.statusText}`)
    
    const text = await res.text()
    if (res.ok) {
      const json = JSON.parse(text)
      console.log(`✅ Success!`)
      return json
    } else {
      console.log(`❌ Error: ${text}`)
      return null
    }
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`)
    return null
  }
}

// Test cases
async function runTests() {
  console.log('🔍 Podcast Index API Test Suite')
  console.log(`Key: ${key.substring(0, 8)}...`)
  console.log(`Secret: ${secret.substring(0, 8)}...`)

  // 1. Search by term
  const searchResult = await apiCall(
    'https://api.podcastindex.org/api/1.0/search/byterm?q=cnn',
    'Search by term (CNN)'
  )
  if (searchResult?.feeds?.length > 0) {
    console.log(`Found ${searchResult.feeds.length} podcasts`)
    const first = searchResult.feeds[0]
    console.log(`First: ${first.title} (ID: ${first.id})`)
  }

  // 2. Get podcast by ID
  const podcastResult = await apiCall(
    'https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=169991',
    'Get podcast by feed ID (169991)'
  )
  if (podcastResult?.podcast) {
    console.log(`Podcast: ${podcastResult.podcast.title}`)
    console.log(`Feed URL: ${podcastResult.podcast.feedUrl}`)
  }

  // 3. Get episodes by feed URL
  if (podcastResult?.podcast?.feedUrl) {
    const feedUrl = encodeURIComponent(podcastResult.podcast.feedUrl)
    const episodesResult = await apiCall(
      `https://api.podcastindex.org/api/1.0/episodes/byfeedurl?url=${feedUrl}`,
      'Get episodes by feed URL'
    )
    if (episodesResult?.episodes?.length > 0) {
      console.log(`Found ${episodesResult.episodes.length} episodes`)
      const latest = episodesResult.episodes[0]
      console.log(`Latest: ${latest.title} (${latest.duration}s)`)
    }
  }

  // 4. Alternative: Get episodes by feed ID
  const episodesByIdResult = await apiCall(
    'https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=169991',
    'Get episodes by feed ID (169991)'
  )
  if (episodesByIdResult?.episodes?.length > 0) {
    console.log(`Found ${episodesByIdResult.episodes.length} episodes`)
  }

  console.log('\n✅ All tests completed!')
}

runTests().catch(console.error)

// Usage: PowerShell
// $env:PI_KEY='<your-key>'; $env:PI_SECRET='<your-secret>'; node d:\Code\podcast-realtime-transcription\scripts\test-podcastindex.mjs