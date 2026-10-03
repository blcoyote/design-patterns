from dataclasses import dataclass


# [iterable]
# Python's iterator protocol is built into the language itself — the same
# protocol that makes for...in and the * unpacking operator work on lists,
# dicts and sets. Playlist only has to implement it:
#   class Iterable(Protocol):
#       def __iter__(self) -> "Iterator": ...
# [/iterable]

# [iteratorInterface]
#   class Iterator(Protocol):
#       def __next__(self): ...  # returns the next value, or raises StopIteration
# [/iteratorInterface]


@dataclass
class Song:
    title: str


# [playlist]
class Playlist:
    def __init__(self, songs: list[Song]) -> None:
        self._songs = songs

    # [getIterator]
    def __iter__(self) -> "PlaylistIterator":
        return PlaylistIterator(self)
    # [/getIterator]

    # [holds]
    # at()/length are exposed only so PlaylistIterator can read songs by
    # index — the GoF equivalent of a ConcreteAggregate's Count()/GetItem().
    # A collection with no traversal needs could keep the list fully
    # private and hide it behind a closure instead.
    def at(self, index: int) -> Song | None:
        return self._songs[index] if 0 <= index < len(self._songs) else None

    @property
    def length(self) -> int:
        return len(self._songs)
    # [/holds]
# [/playlist]


# [playlistIterator]
class PlaylistIterator:
    def __init__(self, playlist: Playlist) -> None:
        self._playlist = playlist
        self._cursor = 0

    # [next]
    def __next__(self) -> Song:
        if self._cursor >= self._playlist.length:
            raise StopIteration
        song = self._playlist.at(self._cursor)
        assert song is not None
        self._cursor += 1
        return song
    # [/next]
# [/playlistIterator]


# [usage]
playlist = Playlist([Song("Intro"), Song("Verse"), Song("Chorus"), Song("Outro")])

# for...in calls __iter__() once, then __next__() until StopIteration is raised.
for song in playlist:
    print(song.title)  # "Intro", "Verse", "Chorus", "Outro"

# What the loop above does under the hood:
it = iter(playlist)
while True:
    try:
        result = next(it)
    except StopIteration:
        break
    print(result.title)
# [/usage]

# A generator implements the same protocol with far less bookkeeping: a
# function using `yield` is automatically a valid iterator source, and each
# `yield` produces one element, pausing until the next __next__() call.
class GeneratorPlaylist:
    def __init__(self, songs: list[Song]) -> None:
        self._songs = songs

    def __iter__(self):
        for song in self._songs:
            yield song
