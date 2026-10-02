import type { PatternDefinition } from '@/types/pattern'
import { IteratorVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'iterator',
  name: 'Iterator',
  category: 'behavioral',
  order: 4,
  summary: 'Step through a collection one element at a time through a uniform next() interface, without exposing how it is stored.',
  intent: 'Provide a way to access the elements of a collection sequentially without exposing its underlying representation.',
  problem:
    'A Playlist might be backed by an array today and a linked list — or a lazily-fetched page of results — tomorrow. If every caller loops over playlist.songs[i] directly, that internal detail leaks into every call site, and the moment the backing storage changes, all of them break.',
  solution:
    'Give the collection a single method that returns an Iterator — a small object with one job, next(), which returns the next value together with a done flag. Callers step through with next() (or let a for...of loop do it for them) without ever knowing whether the elements live in an array, a tree, or are generated on demand.',
  analogy:
    'A museum audio guide: you press "next" and it describes whatever exhibit comes next, in order, one at a time. You never need the museum\'s floor plan or storage room — the guide tracks your position for you, and gives a clear "that was the last one" cue when the tour ends.',
  whenToUse: [
    'You need to traverse a collection without exposing its internal representation (array, linked list, tree, …).',
    'You want a uniform way to step through different kinds of collections using the same client code.',
    'You need several independent traversals over the same collection happening at once.',
  ],
  pros: [
    'Decouples traversal logic from the collection, which stays free to change its internal structure.',
    'Supports multiple simultaneous iterators over the same collection, each with its own cursor.',
    'Gives every collection a uniform traversal interface, so client code — for...of, spread, destructuring — works the same everywhere.',
  ],
  cons: [
    'Overkill for a simple array you would just loop over directly.',
    'An extra object per traversal adds a little indirection and allocation overhead.',
    'Modifying the underlying collection while an iterator is live can produce inconsistent or skipped results.',
  ],
  realWorld: [
    'Arrays, Strings, Maps and Sets all implement the iteration protocol, which is why for...of and spread (...) work on them.',
    'Generator functions (function*) implement Iterator<T> automatically — yield replaces hand-written next() bookkeeping.',
    "Java's Iterable/Iterator, C#'s IEnumerable/IEnumerator, Python's __iter__/__next__",
    'Database cursors and paginated API clients that fetch results lazily behind a uniform next() call',
  ],
  related: ['composite', 'factory-method', 'template-method'],

  participants: [
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 110,
      y: 250,
      description: 'Drives the traversal with a for...of loop (or by calling next() directly), without knowing whether Playlist stores songs in an array, a tree, or streams them lazily.',
      code: 'usage',
    },
    {
      id: 'iterable',
      label: 'Iterable<Song>',
      role: 'Aggregate interface',
      kind: 'interface',
      x: 320,
      y: 70,
      width: 160,
      description: 'Declares [Symbol.iterator](), the one method every traversable collection must provide. Any class implementing it works with for...of and spread.',
    },
    {
      id: 'playlist',
      label: 'Playlist',
      role: 'Concrete Aggregate',
      kind: 'class',
      x: 320,
      y: 250,
      width: 160,
      description: 'Stores the actual songs in a private array and implements [Symbol.iterator]() by handing back a brand-new PlaylistIterator positioned at the start.',
    },
    {
      id: 'iteratorInterface',
      label: 'Iterator<Song>',
      role: 'Iterator interface',
      kind: 'interface',
      x: 620,
      y: 70,
      width: 160,
      description: 'Declares next(), which returns { value, done }. Client code only ever talks to objects through this interface, never to a concrete iterator class.',
    },
    {
      id: 'playlistIterator',
      label: 'PlaylistIterator',
      role: 'Concrete Iterator',
      kind: 'class',
      x: 620,
      y: 250,
      width: 170,
      description: 'Holds a reference to the Playlist plus a private cursor. Each next() call reads the song at the cursor, advances it, and reports done once the cursor passes the last song.',
    },
  ],

  relations: [
    {
      id: 'implIterable',
      from: 'playlist',
      to: 'iterable',
      type: 'implements',
      description: 'Playlist implements Iterable<Song>, so anything that accepts an Iterable — including a for...of loop — accepts a Playlist.',
    },
    {
      id: 'implIterator',
      from: 'playlistIterator',
      to: 'iteratorInterface',
      type: 'implements',
      description: 'PlaylistIterator implements Iterator<Song>, so client code can call next() on it without knowing its concrete type.',
    },
    {
      id: 'creates',
      from: 'playlist',
      to: 'playlistIterator',
      type: 'creates',
      label: '[Symbol.iterator]()',
      description: 'Each call to [Symbol.iterator]() creates a brand-new PlaylistIterator with its own cursor, so two simultaneous loops over the same playlist never interfere with each other.',
      code: 'getIterator',
    },
    {
      id: 'holds',
      from: 'playlistIterator',
      to: 'playlist',
      type: 'holds',
      label: 'songs, cursor',
      description: 'The iterator holds a reference back to the Playlist so it can read songs by index — the playlist itself never tracks position.',
      code: 'holds',
    },
    {
      id: 'clientGetIterator',
      from: 'client',
      to: 'playlist',
      type: 'calls',
      label: '[Symbol.iterator]()',
      description: 'A for...of loop starts by calling playlist[Symbol.iterator]() to obtain an iterator.',
      code: 'getIterator',
    },
    {
      id: 'clientNext',
      from: 'client',
      to: 'playlistIterator',
      type: 'calls',
      label: 'next()',
      description: 'The loop repeatedly calls next() on the iterator until it reports done: true.',
      code: 'next',
      bend: 30,
    },
  ],

  steps: [
    {
      title: 'Client starts a for...of loop',
      description: 'A for...of loop over playlist implicitly calls playlist[Symbol.iterator](). Playlist creates a brand-new PlaylistIterator and hands it back — the loop never touches the song array directly.',
      highlight: ['client', 'clientGetIterator', 'playlist', 'creates', 'playlistIterator'],
      packets: [
        { relation: 'clientGetIterator', label: '[Symbol.iterator]()' },
        { relation: 'clientGetIterator', label: 'iterator', reverse: true },
      ],
      notes: { playlist: '4 songs', playlistIterator: 'cursor: 0' },
      code: 'getIterator',
    },
    {
      title: 'First next() yields "Intro"',
      description: 'The loop calls next() on the iterator. It reads the song at the current cursor position, advances the cursor, and returns { value: "Intro", done: false }.',
      highlight: ['client', 'clientNext', 'playlistIterator', 'holds'],
      packets: [
        { relation: 'clientNext', label: 'next()' },
        { relation: 'clientNext', label: '"Intro"', reverse: true },
      ],
      notes: { playlistIterator: 'cursor: 0 → 1' },
      code: 'next',
    },
    {
      title: 'Second next() yields "Verse"',
      description: 'The client never changes how it asks — it calls next() again. The iterator moves its cursor forward and returns the next song.',
      highlight: ['client', 'clientNext', 'playlistIterator', 'holds'],
      packets: [
        { relation: 'clientNext', label: 'next()' },
        { relation: 'clientNext', label: '"Verse"', reverse: true },
      ],
      notes: { playlistIterator: 'cursor: 1 → 2' },
      code: 'next',
    },
    {
      title: 'Third next() yields "Chorus"',
      description: 'Same call, same shape of answer. The iterator is the only thing that knows where it is in the traversal.',
      highlight: ['client', 'clientNext', 'playlistIterator', 'holds'],
      packets: [
        { relation: 'clientNext', label: 'next()' },
        { relation: 'clientNext', label: '"Chorus"', reverse: true },
      ],
      notes: { playlistIterator: 'cursor: 2 → 3' },
      code: 'next',
    },
    {
      title: 'Fourth next() yields "Outro"',
      description: 'The cursor reaches the last song. next() still returns done: false here — the iterator only reports done once it is asked for an element past the end.',
      highlight: ['client', 'clientNext', 'playlistIterator', 'holds'],
      packets: [
        { relation: 'clientNext', label: 'next()' },
        { relation: 'clientNext', label: '"Outro"', reverse: true },
      ],
      notes: { playlistIterator: 'cursor: 3 → 4' },
      code: 'next',
    },
    {
      title: 'next() reports done',
      description: 'The cursor has now passed the last song. next() returns { value: undefined, done: true } instead of throwing or wrapping back around.',
      highlight: ['client', 'clientNext', 'playlistIterator'],
      packets: [
        { relation: 'clientNext', label: 'next()' },
        { relation: 'clientNext', label: 'done: true', reverse: true },
      ],
      notes: { playlistIterator: 'done' },
      code: 'next',
    },
    {
      title: 'The loop exits cleanly',
      description: 'for...of checks the done flag after every call and stops automatically. The client never had to know how many songs were in the playlist, or manage a cursor itself.',
      highlight: ['client', 'playlist', 'playlistIterator'],
      code: 'usage',
    },
  ],

  code: `
// [iterable]
interface Iterable<T> {
  [Symbol.iterator](): Iterator<T>
}
// [/iterable]

// [iteratorInterface]
interface Iterator<T> {
  next(): IteratorResult<T>
}

interface IteratorResult<T> {
  value: T | undefined
  done: boolean
}
// [/iteratorInterface]

interface Song {
  title: string
}

// [playlist]
class Playlist implements Iterable<Song> {
  private readonly songs: Song[]

  constructor(songs: Song[]) {
    this.songs = songs
  }

  // [getIterator]
  [Symbol.iterator](): Iterator<Song> {
    return new PlaylistIterator(this)
  }
  // [/getIterator]

  // [holds]
  at(index: number): Song | undefined {
    return this.songs[index]
  }

  get length(): number {
    return this.songs.length
  }
  // [/holds]
}
// [/playlist]

// [playlistIterator]
class PlaylistIterator implements Iterator<Song> {
  private cursor = 0

  constructor(private readonly playlist: Playlist) {}

  // [next]
  next(): IteratorResult<Song> {
    if (this.cursor >= this.playlist.length) {
      return { value: undefined, done: true }
    }
    return { value: this.playlist.at(this.cursor++), done: false }
  }
  // [/next]
}
// [/playlistIterator]

// [usage]
const playlist = new Playlist([{ title: 'Intro' }, { title: 'Verse' }, { title: 'Chorus' }, { title: 'Outro' }])

// for...of calls [Symbol.iterator]() once, then next() until done is true.
for (const song of playlist) {
  console.log(song.title) // "Intro", "Verse", "Chorus", "Outro"
}

// What the loop above does under the hood:
const it = playlist[Symbol.iterator]()
let result = it.next()
while (!result.done) {
  console.log(result.value!.title)
  result = it.next()
}
// [/usage]

// A generator implements the same protocol with far less bookkeeping: a
// function*() body is automatically a valid Iterator<T> source, and each
// \`yield\` produces one element, pausing until the next next() call.
class GeneratorPlaylist implements Iterable<Song> {
  constructor(private readonly songs: Song[]) {}

  *[Symbol.iterator](): Iterator<Song> {
    for (const song of this.songs) {
      yield song
    }
  }
}
`,

  Visualization: IteratorVisualization,
}
