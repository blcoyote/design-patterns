// Usage
IVideoService client = new CachingVideoProxy();

client.GetVideo("v1"); // cache miss: lazily creates RealVideoService, fetches, caches
client.GetVideo("v1"); // cache hit: served from the cache, RealVideoService untouched

// [videoService]
interface IVideoService
{
    Video GetVideo(string id);
}
// [/videoService]

record Video(string Id, string Url);

// [realService]
class RealVideoService : IVideoService
{
    public Video GetVideo(string id)
    {
        Console.WriteLine($"fetching video {id} from the network...");
        // Pretend this is a slow call to a remote API.
        return new Video(id, $"https://cdn.example.com/{id}.mp4");
    }
}
// [/realService]

// [proxy]
class CachingVideoProxy : IVideoService
{
    private RealVideoService? _real;
    private readonly Dictionary<string, Video> _cache = new();

    // [getVideo]
    public Video GetVideo(string id)
    {
        if (_cache.TryGetValue(id, out var cached)) return cached;

        // [lazyCreate]
        _real ??= new RealVideoService();
        // [/lazyCreate]

        // [forward]
        var video = _real.GetVideo(id);
        _cache[id] = video;
        // [/forward]

        return video;
    }
    // [/getVideo]
}
// [/proxy]
