// [iterable]
// Iterable<T> and Iterator<T> are built into TypeScript's standard library
// (lib.es2015.iterable) — the same interfaces that make for...of and spread
// work on arrays, Maps and Sets. Playlist only has to implement them:
//   interface Iterable<T> { [Symbol.iterator](): Iterator<T> }
// [/iterable]

// [iteratorInterface]
//   interface Iterator<T> { next(): IteratorResult<T> }
//   type IteratorResult<T> = { done: false; value: T } | { done: true; value: undefined }
// [/iteratorInterface]

interface Song {
  title: string;
}

// [playlist]
class Playlist implements Iterable<Song> {
  private readonly songs: Song[];

  constructor(songs: Song[]) {
    this.songs = songs;
  }

  // [getIterator]
  [Symbol.iterator](): Iterator<Song> {
    return new PlaylistIterator(this);
  }
  // [/getIterator]

  // [holds]
  // at()/length are exposed only so PlaylistIterator can read songs by
  // index — the GoF equivalent of a ConcreteAggregate's Count()/GetItem().
  // A collection with no traversal needs could keep the array fully
  // private and hide it behind a closure instead.
  at(index: number): Song | undefined {
    return this.songs[index];
  }

  get length(): number {
    return this.songs.length;
  }
  // [/holds]
}
// [/playlist]

// [playlistIterator]
class PlaylistIterator implements Iterator<Song> {
  private cursor = 0;

  constructor(private readonly playlist: Playlist) {}

  // [next]
  next(): IteratorResult<Song> {
    if (this.cursor >= this.playlist.length) {
      return { done: true, value: undefined };
    }
    const song = this.playlist.at(this.cursor)!;
    this.cursor++;
    return { done: false, value: song };
  }
  // [/next]
}
// [/playlistIterator]

// [usage]
const playlist = new Playlist([
  { title: "Intro" },
  { title: "Verse" },
  { title: "Chorus" },
  { title: "Outro" },
]);

// for...of calls [Symbol.iterator]() once, then next() until done is true.
for (const song of playlist) {
  console.log(song.title); // "Intro", "Verse", "Chorus", "Outro"
}

// What the loop above does under the hood:
const it = playlist[Symbol.iterator]();
let result = it.next();
while (!result.done) {
  console.log(result.value.title);
  result = it.next();
}
// [/usage]

// A generator implements the same protocol with far less bookkeeping: a
// function*() body is automatically a valid Iterator<T> source, and each
// `yield` produces one element, pausing until the next next() call.
class GeneratorPlaylist implements Iterable<Song> {
  constructor(private readonly songs: Song[]) {}

  *[Symbol.iterator](): Iterator<Song> {
    for (const song of this.songs) {
      yield song;
    }
  }
}
