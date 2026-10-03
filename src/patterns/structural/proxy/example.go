package main

import "fmt"

// [videoService]
type VideoService interface {
	GetVideo(id string) *Video
}

// [/videoService]

type Video struct {
	ID  string
	URL string
}

// [realService]
type RealVideoService struct{}

func (s *RealVideoService) GetVideo(id string) *Video {
	fmt.Printf("fetching video %s from the network...\n", id)
	// Pretend this is a slow call to a remote API.
	return &Video{ID: id, URL: fmt.Sprintf("https://cdn.example.com/%s.mp4", id)}
}

// [/realService]

// [proxy]
type CachingVideoProxy struct {
	real  *RealVideoService
	cache map[string]*Video
}

func NewCachingVideoProxy() *CachingVideoProxy {
	return &CachingVideoProxy{cache: map[string]*Video{}}
}

// [getVideo]
func (p *CachingVideoProxy) GetVideo(id string) *Video {
	if cached, ok := p.cache[id]; ok {
		return cached
	}

	// [lazyCreate]
	if p.real == nil {
		p.real = &RealVideoService{}
	}
	// [/lazyCreate]

	// [forward]
	video := p.real.GetVideo(id)
	p.cache[id] = video
	// [/forward]

	return video
}

// [/getVideo]

// [/proxy]

func main() {
	var client VideoService = NewCachingVideoProxy()

	client.GetVideo("v1") // cache miss: lazily creates RealVideoService, fetches, caches
	client.GetVideo("v1") // cache hit: served from the cache, RealVideoService untouched
}
