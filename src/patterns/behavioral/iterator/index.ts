import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { IteratorVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "iterator",
  name: "Iterator",
  category: "behavioral",
  order: 4,
  summary:
    "Step through a collection one element at a time through a uniform next() interface, without exposing how it is stored.",
  intent:
    'Walk through a collection one element at a time without knowing, or caring, how it stores its items.',
  problem:
    "A Playlist might be backed by an array today and by a linked list, or a lazily fetched page of results, tomorrow. If every caller loops over playlist.songs[i] directly, that internal detail leaks into every call site. The moment the storage changes, all of those loops break.",
  solution:
    "Give the collection one method that returns an Iterator: a small object whose job is to hand out the next value and say when there are none left. In TypeScript, next() returns a result with a done flag. In C#, MoveNext() returns false. In Python, __next__() raises StopIteration. In Go, Next() returns the value plus an ok flag. Callers step through with next() (or let a for...of / foreach / for ... in loop do it for them) without ever knowing whether the elements live in an array, a tree, or are generated on demand.",
  analogy:
    "Think of a museum audio guide. You press \"next\" and it describes the next exhibit, in order, one at a time. You never need the floor plan or the storage room. The guide keeps track of your position and gives a clear \"that was the last one\" cue when the tour ends.",
  whenToUse: [
    "You need to walk through a collection without exposing how it is stored (array, linked list, tree, ...).",
    "You want one uniform way to step through different kinds of collections with the same client code.",
    "You need several independent traversals of the same collection at the same time.",
  ],
  pros: [
    "Separates traversal from the collection, so the collection is free to change how it stores its data.",
    "Supports several iterators over the same collection at once, each with its own cursor.",
    "Gives every collection the same traversal interface, so client code (for...of, spread, destructuring) works the same everywhere.",
  ],
  cons: [
    "Overkill for a simple array that you could just loop over directly.",
    "Each traversal needs an extra object, which adds a little indirection and allocation.",
    "Changing the collection while an iterator is in use can give inconsistent or skipped results.",
  ],
  realWorld: [
    "Arrays, Strings, Maps and Sets all implement the iteration protocol, which is why for...of and spread (...) work on them.",
    "Generator functions (function*) produce an Iterator<T> automatically: yield replaces hand-written next() bookkeeping.",
    "Java's Iterable/Iterator, C#'s IEnumerable/IEnumerator, Python's __iter__/__next__",
    "Database cursors and paginated API clients that fetch results lazily behind a uniform next() call",
  ],
  related: ["composite", "factory-method", "template-method"],

  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 110,
      y: 250,
      description:
        "Drives the traversal with a for...of loop (or by calling next() directly), without knowing whether Playlist stores songs in an array, a tree, or streams them lazily.",
      code: "usage",
    },
    {
      id: "iterable",
      label: "Iterable<Song>",
      role: "Aggregate interface",
      kind: "interface",
      x: 320,
      y: 70,
      width: 160,
      description:
        "Declares the one method every traversable collection must provide — [Symbol.iterator]() in TS, GetEnumerator() in C#, __iter__() in Python, GetIterator() in Go (which has no built-in protocol for custom collections). Any class implementing it works with the language's built-in loop.",
    },
    {
      id: "playlist",
      label: "Playlist",
      role: "Concrete Aggregate",
      kind: "class",
      x: 320,
      y: 250,
      width: 160,
      description:
        "Stores the actual songs in a private array and implements the iterable method by handing back a brand-new PlaylistIterator positioned at the start.",
    },
    {
      id: "iteratorInterface",
      label: "Iterator<Song>",
      role: "Iterator interface",
      kind: "interface",
      x: 620,
      y: 70,
      width: 160,
      description:
        "Declares next(), which returns the next value or signals the end — { value, done } in TS, MoveNext()/Current in C#, __next__() raising StopIteration in Python, Next() returning (value, ok) in Go. Client code only ever talks to objects through this interface, never to a concrete iterator class.",
    },
    {
      id: "playlistIterator",
      label: "PlaylistIterator",
      role: "Concrete Iterator",
      kind: "class",
      x: 620,
      y: 250,
      width: 170,
      description:
        "Holds a reference to the Playlist plus a private cursor. Each next() call reads the song at the cursor, advances it, and reports done once the cursor passes the last song.",
    },
  ],

  relations: [
    {
      id: "implIterable",
      from: "playlist",
      to: "iterable",
      type: "implements",
      description:
        "Playlist implements Iterable<Song>, so anything that accepts an Iterable — including a for...of loop — accepts a Playlist.",
    },
    {
      id: "implIterator",
      from: "playlistIterator",
      to: "iteratorInterface",
      type: "implements",
      description:
        "PlaylistIterator implements Iterator<Song>, so client code can call next() on it without knowing its concrete type.",
    },
    {
      id: "creates",
      from: "playlist",
      to: "playlistIterator",
      type: "creates",
      label: "[Symbol.iterator]()",
      description:
        "Each call to the iterable method creates a brand-new PlaylistIterator with its own cursor, so two simultaneous loops over the same playlist never interfere with each other.",
      code: "getIterator",
    },
    {
      id: "holds",
      from: "playlistIterator",
      to: "playlist",
      type: "holds",
      label: "songs, cursor",
      description:
        "The iterator holds a reference back to the Playlist so it can read songs by index — the playlist itself never tracks position.",
      code: "holds",
    },
    {
      id: "clientGetIterator",
      from: "client",
      to: "playlist",
      type: "calls",
      label: "[Symbol.iterator]()",
      description:
        "A for...of loop starts by asking the playlist for an iterator (playlist[Symbol.iterator]() / GetEnumerator() / iter(playlist) / playlist.GetIterator()).",
      code: "getIterator",
    },
    {
      id: "clientNext",
      from: "client",
      to: "playlistIterator",
      type: "calls",
      label: "next()",
      description:
        "The loop repeatedly calls next() on the iterator until it reports that it is done.",
      code: "next",
      bend: 30,
    },
  ],

  steps: [
    {
      title: "Client starts a for...of loop",
      description:
        "A for...of loop over playlist implicitly asks it for an iterator (playlist[Symbol.iterator]() / GetEnumerator() / __iter__() / GetIterator()). Playlist creates a brand-new PlaylistIterator and hands it back — the loop never touches the song array directly.",
      highlight: [
        "client",
        "clientGetIterator",
        "playlist",
        "creates",
        "playlistIterator",
      ],
      packets: [
        { relation: "clientGetIterator", label: "[Symbol.iterator]()" },
        {
          relation: "clientGetIterator",
          label: "iterator",
          reverse: true,
          after: 0,
        },
      ],
      notes: { playlist: "4 songs", playlistIterator: "cursor: 0" },
      code: "getIterator",
    },
    {
      title: 'First next() yields "Intro"',
      description:
        'The loop calls next() on the iterator. It reads the song at the current cursor position, advances the cursor, and returns "Intro".',
      highlight: ["client", "clientNext", "playlistIterator", "holds"],
      packets: [
        { relation: "clientNext", label: "next()" },
        { relation: "clientNext", label: '"Intro"', reverse: true, after: 0 },
      ],
      notes: { playlistIterator: "cursor: 0 → 1" },
      code: "next",
    },
    {
      title: 'Second next() yields "Verse"',
      description:
        "The client never changes how it asks — it calls next() again. The iterator moves its cursor forward and returns the next song.",
      highlight: ["client", "clientNext", "playlistIterator", "holds"],
      packets: [
        { relation: "clientNext", label: "next()" },
        { relation: "clientNext", label: '"Verse"', reverse: true, after: 0 },
      ],
      notes: { playlistIterator: "cursor: 1 → 2" },
      code: "next",
    },
    {
      title: 'Third next() yields "Chorus"',
      description:
        "Same call, same shape of answer. The iterator is the only thing that knows where it is in the traversal.",
      highlight: ["client", "clientNext", "playlistIterator", "holds"],
      packets: [
        { relation: "clientNext", label: "next()" },
        { relation: "clientNext", label: '"Chorus"', reverse: true, after: 0 },
      ],
      notes: { playlistIterator: "cursor: 2 → 3" },
      code: "next",
    },
    {
      title: 'Fourth next() yields "Outro"',
      description:
        "The cursor reaches the last song. next() still returns a song here — the iterator only reports the end once it is asked for an element past it.",
      highlight: ["client", "clientNext", "playlistIterator", "holds"],
      packets: [
        { relation: "clientNext", label: "next()" },
        { relation: "clientNext", label: '"Outro"', reverse: true, after: 0 },
      ],
      notes: { playlistIterator: "cursor: 3 → 4" },
      code: "next",
    },
    {
      title: "next() reports done",
      description:
        "The cursor has now passed the last song. next() signals the end instead of wrapping back around: TS returns { value: undefined, done: true }, C# MoveNext() returns false, Python __next__() raises StopIteration, and Go Next() returns ok = false — the protocol's agreed end signal, which the loop catches for you.",
      highlight: ["client", "clientNext", "playlistIterator"],
      packets: [
        { relation: "clientNext", label: "next()" },
        {
          relation: "clientNext",
          label: "done: true",
          reverse: true,
          after: 0,
        },
      ],
      notes: { playlistIterator: "done" },
      code: "next",
    },
    {
      title: "The loop exits cleanly",
      description:
        "The loop checks for the end signal after every call and stops automatically. The client never had to know how many songs were in the playlist, or manage a cursor itself.",
      highlight: ["client", "playlist", "playlistIterator"],
      code: "usage",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  Visualization: IteratorVisualization,
};
