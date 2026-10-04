package main

import (
	"fmt"
	"iter"
)

// [iterable]
// Unlike TypeScript, C# or Python, Go's standard library has no iterator
// interfaces for custom collections: the language only ranges over built-in
// types, channels and functions (iter.Seq, below). So the GoF roles are
// declared here as small interfaces, and Playlist only has to implement them:
type Iterable[T any] interface {
	GetIterator() Iterator[T]
}

// [/iterable]

// [iteratorInterface]
// Next returns the next value and true, or the zero value and false once the
// traversal is finished (the comma-ok idiom stands in for StopIteration).
type Iterator[T any] interface {
	Next() (T, bool)
}

// [/iteratorInterface]

type Song struct {
	Title string
}

// [playlist]
type Playlist struct {
	songs []Song
}

func NewPlaylist(songs []Song) *Playlist {
	return &Playlist{songs: songs}
}

// [getIterator]
func (p *Playlist) GetIterator() Iterator[Song] {
	return &PlaylistIterator{playlist: p}
}

// [/getIterator]

// [holds]
// At()/Length() are exposed only so PlaylistIterator can read songs by
// index — the GoF equivalent of a ConcreteAggregate's Count()/GetItem().
// A collection with no traversal needs could keep the slice fully
// private and hide it behind a closure instead.
func (p *Playlist) At(index int) (Song, bool) {
	if index >= 0 && index < len(p.songs) {
		return p.songs[index], true
	}
	return Song{}, false
}

func (p *Playlist) Length() int {
	return len(p.songs)
}

// [/holds]
// [/playlist]

// [playlistIterator]
type PlaylistIterator struct {
	playlist *Playlist
	cursor   int
}

// [next]
func (it *PlaylistIterator) Next() (Song, bool) {
	if it.cursor >= it.playlist.Length() {
		return Song{}, false
	}
	song, _ := it.playlist.At(it.cursor)
	it.cursor++
	return song, true
}

// [/next]
// [/playlistIterator]

// A range-over-func iterator (iter.Seq, Go 1.23+) implements the same idea
// with far less bookkeeping: the function calls yield once per element, and
// `for ... range` stops it by making yield return false. It is Go's
// counterpart of a generator.
type GeneratorPlaylist struct {
	songs []Song
}

func (g *GeneratorPlaylist) All() iter.Seq[Song] {
	return func(yield func(Song) bool) {
		for _, song := range g.songs {
			if !yield(song) {
				return
			}
		}
	}
}

func main() {
	// [usage]
	playlist := NewPlaylist([]Song{{"Intro"}, {"Verse"}, {"Chorus"}, {"Outro"}})

	// range doesn't understand this hand-written Iterator interface, so the loop
	// is written out: GetIterator() once, then Next() until it reports there is
	// nothing left. (GeneratorPlaylist.All() above is what range consumes directly.)
	it := playlist.GetIterator()
	for song, ok := it.Next(); ok; song, ok = it.Next() {
		fmt.Println(song.Title) // "Intro", "Verse", "Chorus", "Outro"
	}

	// The same traversal, spelled out step by step:
	it = playlist.GetIterator()
	for {
		result, ok := it.Next()
		if !ok {
			break
		}
		fmt.Println(result.Title)
	}
	// [/usage]
}
