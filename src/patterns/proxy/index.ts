import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'proxy',
  name: 'Proxy',
  category: 'structural',
  order: 4,
  summary: 'Provide a stand-in for another object that controls access to it.',
  intent: 'Provide a surrogate or placeholder for another object to control access to it.',
  problem:
    'Some objects are expensive to create, live behind a slow network, or need access rules enforced before every call. Creating them eagerly, or trusting every caller to check permissions themselves, wastes resources and scatters the same guard logic across the codebase.',
  solution:
    'Give the proxy the exact same interface as the real object, so callers cannot tell them apart. The proxy forwards calls to the real object, but can delay creating it, cache results, check permissions, or add logging first — all without the caller or the real object knowing. This differs from Decorator, which is always handed an already-existing object to wrap: a proxy instead controls access to and often owns the lifecycle of the one real subject it stands in for.',
  analogy:
    'A credit card is a proxy for the cash in your bank account. The merchant accepts it exactly like cash, but it adds a layer that can check your balance, log the transaction, or decline the charge — without the account itself being touched for every tiny decision.',
  whenToUse: [
    'Creating the real object is expensive and it may never actually be needed (virtual proxy / lazy loading).',
    'Calls go over a network and you want a local stand-in with the same interface (remote proxy).',
    'You need to add access control, logging, or caching in front of an object without changing it (protection / caching proxy).',
  ],
  pros: [
    'Controls access to the real object without the client or the object itself knowing.',
    'Virtual proxies can defer expensive work until it is actually needed.',
    'Caching proxies can serve repeated requests without hitting the real object again.',
  ],
  cons: [
    'Adds an extra layer of indirection, which can complicate the code.',
    'A caching proxy can return stale data if invalidation is not handled carefully.',
    'With a virtual proxy, the first call pays the deferred creation cost that every later call avoids.',
  ],
  realWorld: [
    'ES2015 Proxy objects for intercepting property access',
    'ORMs that return lazy-loading proxies for related records',
    'CDN edge caches acting as caching proxies in front of an origin server',
    'gRPC/REST client stubs acting as remote proxies for a networked service',
  ],
  related: ['decorator', 'adapter', 'facade', 'flyweight'],
  participants: [
    {
      id: 'videoService',
      label: 'VideoService',
      role: 'Subject interface',
      kind: 'interface',
      x: 400,
      y: 60,
      description: 'Declares getVideo(id). Both the real service and the proxy implement it, so a client cannot tell them apart.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 120,
      y: 250,
      description: 'Only ever holds a VideoService reference. It always talks to the proxy, never to the real service directly.',
    },
    {
      id: 'proxy',
      label: 'CachingVideoProxy',
      role: 'Proxy',
      kind: 'class',
      x: 400,
      y: 250,
      width: 180,
      description: 'Implements VideoService. Keeps a cache and a lazily-created reference to the real service, and decides whether to use either.',
    },
    {
      id: 'realService',
      label: 'RealVideoService',
      role: 'Real Subject',
      kind: 'class',
      x: 660,
      y: 250,
      width: 170,
      description: 'Does the actual, expensive work — here, "fetching" a video from the network. Only created when first needed.',
    },
  ],
  relations: [
    {
      id: 'request',
      from: 'client',
      to: 'proxy',
      type: 'calls',
      label: 'getVideo()',
      description: 'The client always calls the proxy, using the exact same interface the real service would expose.',
      code: 'getVideo',
    },
    { id: 'proxy-impl', from: 'proxy', to: 'videoService', type: 'implements', description: 'CachingVideoProxy implements VideoService.' },
    {
      id: 'real-impl',
      from: 'realService',
      to: 'videoService',
      type: 'implements',
      description: 'RealVideoService implements the same VideoService interface.',
      bend: 30,
    },
    {
      id: 'holds-real',
      from: 'proxy',
      to: 'realService',
      type: 'holds',
      label: 'real',
      description: 'The proxy stores its lazily-created real service in a field, starting out null until the first cache miss needs it.',
      bend: 0,
      code: 'proxy',
    },
    {
      id: 'lazy-create',
      from: 'proxy',
      to: 'realService',
      type: 'creates',
      label: 'new (lazy)',
      description: 'On the first cache miss, the proxy constructs the real service. If no request ever needs it, it is never created at all.',
      bend: 28,
      code: 'lazyCreate',
    },
    {
      id: 'forward',
      from: 'proxy',
      to: 'realService',
      type: 'calls',
      label: 'getVideo()',
      description: 'Once the real service exists, the proxy forwards the call to it and stores the result in its cache.',
      bend: -28,
      code: 'forward',
    },
  ],
  steps: [
    {
      title: 'First request — cache miss',
      description: 'The client asks the proxy for a video. The proxy checks its cache first and finds nothing for this id.',
      highlight: ['client', 'request'],
      packets: [{ relation: 'request', label: 'getVideo("v1")' }],
      notes: { proxy: 'cache: miss' },
      code: 'getVideo',
    },
    {
      title: 'Lazy-create the real subject',
      description: 'Because this is the first miss, the proxy constructs RealVideoService right now — not a moment sooner.',
      highlight: ['proxy', 'lazy-create', 'realService'],
      packets: [{ relation: 'lazy-create', label: 'new RealVideoService()' }],
      notes: { realService: 'created' },
      code: 'lazyCreate',
    },
    {
      title: 'Forward and cache the result',
      description: 'The proxy forwards the call to the real service, which does the expensive fetch, and stores the result in its cache.',
      highlight: ['proxy', 'forward', 'realService'],
      packets: [
        { relation: 'forward', label: 'getVideo()' },
        { relation: 'forward', label: 'video', reverse: true },
      ],
      notes: { proxy: 'cached' },
      code: 'forward',
    },
    {
      title: 'Return to the client',
      description: 'The proxy hands the freshly-fetched video back to the client, who never knew the real service was just created.',
      highlight: ['request', 'client'],
      packets: [{ relation: 'request', label: 'video', reverse: true }],
      code: 'getVideo',
    },
    {
      title: 'Second request — cache hit',
      description: 'The client asks for the same video again. This time the proxy answers from its cache — RealVideoService is never touched.',
      highlight: ['client', 'request', 'proxy'],
      packets: [
        { relation: 'request', label: 'getVideo("v1")' },
        { relation: 'request', label: 'video (cached)', reverse: true },
      ],
      notes: { proxy: 'cache hit', realService: 'untouched' },
      code: 'getVideo',
    },
  ],
  code: `
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
    console.log(\`fetching video \${id} from the network...\`)
    // Pretend this is a slow call to a remote API.
    return { id, url: \`https://cdn.example.com/\${id}.mp4\` }
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
`,
  csharp: `
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
`,
}
