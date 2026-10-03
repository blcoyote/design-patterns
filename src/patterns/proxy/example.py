from dataclasses import dataclass
from typing import Protocol


# [videoService]
class VideoService(Protocol):
    def get_video(self, id: str) -> "Video": ...
# [/videoService]


@dataclass
class Video:
    id: str
    url: str


# [realService]
class RealVideoService:
    def get_video(self, id: str) -> Video:
        print(f"fetching video {id} from the network...")
        # Pretend this is a slow call to a remote API.
        return Video(id, f"https://cdn.example.com/{id}.mp4")
# [/realService]


# [proxy]
class CachingVideoProxy:
    def __init__(self) -> None:
        self._real: RealVideoService | None = None
        self._cache: dict[str, Video] = {}

    # [getVideo]
    def get_video(self, id: str) -> Video:
        cached = self._cache.get(id)
        if cached:
            return cached

        # [lazyCreate]
        if self._real is None:
            self._real = RealVideoService()
        # [/lazyCreate]

        # [forward]
        video = self._real.get_video(id)
        self._cache[id] = video
        # [/forward]

        return video
    # [/getVideo]
# [/proxy]


# Usage
client: VideoService = CachingVideoProxy()

client.get_video("v1")  # cache miss: lazily creates RealVideoService, fetches, caches
client.get_video("v1")  # cache hit: served from the cache, RealVideoService untouched
