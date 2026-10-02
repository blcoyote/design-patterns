using System.Collections;

// [usage]
var playlist = new Playlist(new List<Song> { new("Intro"), new("Verse"), new("Chorus"), new("Outro") });

// foreach calls GetEnumerator() once, then MoveNext()/Current until it returns false.
foreach (var song in playlist)
{
    Console.WriteLine(song.Title); // "Intro", "Verse", "Chorus", "Outro"
}

// What the loop above does under the hood:
var it = playlist.GetEnumerator();
while (it.MoveNext())
{
    Console.WriteLine(it.Current.Title);
}
// [/usage]

record Song(string Title);

// [iterable]
// IEnumerable<T> and IEnumerator<T> are built into .NET (System.Collections.Generic)
// — the same interfaces that make foreach and LINQ work on arrays, List<T>
// and Dictionary<T>. Playlist only has to implement them:
//   interface IEnumerable<T> { IEnumerator<T> GetEnumerator(); }
// [/iterable]

// [iteratorInterface]
//   interface IEnumerator<T> { bool MoveNext(); T Current { get; } }
// [/iteratorInterface]

// [playlist]
class Playlist : IEnumerable<Song>
{
    private readonly List<Song> _songs;

    public Playlist(List<Song> songs)
    {
        _songs = songs;
    }

    // [getIterator]
    public IEnumerator<Song> GetEnumerator()
    {
        return new PlaylistIterator(this);
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    // [/getIterator]

    // [holds]
    // At()/Length are exposed only so PlaylistIterator can read songs by
    // index — the GoF equivalent of a ConcreteAggregate's Count()/GetItem().
    // A collection with no traversal needs could keep the list fully
    // private and hide it behind a closure instead.
    public Song? At(int index) => index >= 0 && index < _songs.Count ? _songs[index] : null;

    public int Length => _songs.Count;
    // [/holds]
}
// [/playlist]

// [playlistIterator]
class PlaylistIterator(Playlist playlist) : IEnumerator<Song>
{
    private int _cursor = -1;

    // [next]
    public bool MoveNext()
    {
        if (_cursor + 1 >= playlist.Length) return false;
        _cursor++;
        return true;
    }

    public Song Current => playlist.At(_cursor)!;
    // [/next]

    object IEnumerator.Current => Current!;

    public void Reset() => _cursor = -1;

    public void Dispose()
    {
    }
}
// [/playlistIterator]

// A C# iterator method implements the same protocol with far less
// bookkeeping: a method body using `yield return` is automatically turned
// into a valid IEnumerator<T> source by the compiler, pausing until the
// next MoveNext() call.
class GeneratorPlaylist(List<Song> songs) : IEnumerable<Song>
{
    public IEnumerator<Song> GetEnumerator()
    {
        foreach (var song in songs)
        {
            yield return song;
        }
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
