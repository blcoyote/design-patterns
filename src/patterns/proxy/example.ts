// [videoService]
interface VideoService {
  getVideo(id: string): Video
}
// [/videoService]

interface Video {
  id: string
  url: string
}

// [realService]
class RealVideoService implements VideoService {
  getVideo(id: string): Video {
    console.log(`fetching video ${id} from the network...`)
    // Pretend this is a slow call to a remote API.
    return { id, url: `https://cdn.example.com/${id}.mp4` }
  }
}
// [/realService]

// [proxy]
class CachingVideoProxy implements VideoService {
  private real: RealVideoService | null = null
  private cache = new Map<string, Video>()

  // [getVideo]
  getVideo(id: string): Video {
    const cached = this.cache.get(id)
    if (cached) return cached

    // [lazyCreate]
    if (!this.real) {
      this.real = new RealVideoService()
    }
    // [/lazyCreate]

    // [forward]
    const video = this.real.getVideo(id)
    this.cache.set(id, video)
    // [/forward]

    return video
  }
  // [/getVideo]
}
// [/proxy]

// Usage
const client: VideoService = new CachingVideoProxy()

client.getVideo('v1') // cache miss: lazily creates RealVideoService, fetches, caches
client.getVideo('v1') // cache hit: served from the cache, RealVideoService untouched
