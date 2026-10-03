// [usage]
// Usage
var facade = new HomeTheaterFacade();

facade.WatchMovie("Inception");
// [/usage]

// [amplifier]
class Amplifier
{
    public void On()
    {
        Console.WriteLine("amp: on");
    }
    public void SetVolume(int level)
    {
        Console.WriteLine($"amp: volume {level}");
    }
}
// [/amplifier]

// [dvdPlayer]
class DvdPlayer
{
    public void Play(string movie)
    {
        Console.WriteLine($"dvd: playing {movie}");
    }
}
// [/dvdPlayer]

// [projector]
class Projector
{
    public void On()
    {
        Console.WriteLine("projector: on");
    }
    public void WideScreenMode()
    {
        Console.WriteLine("projector: widescreen");
    }
}
// [/projector]

// [screen]
class Screen
{
    public void Down()
    {
        Console.WriteLine("screen: down");
    }
}
// [/screen]

// [facade]
class HomeTheaterFacade
{
    private readonly Amplifier _amp;
    private readonly DvdPlayer _dvd;
    private readonly Projector _projector;
    private readonly Screen _screen;

    // The facade builds its own subsystem instances by default, so the client
    // never has to know they exist — but a caller that already has one (for
    // testing, or to reuse an existing amplifier) can still inject it.
    public HomeTheaterFacade(Amplifier? amp = null, DvdPlayer? dvd = null, Projector? projector = null, Screen? screen = null)
    {
        _amp = amp ?? new Amplifier();
        _dvd = dvd ?? new DvdPlayer();
        _projector = projector ?? new Projector();
        _screen = screen ?? new Screen();
    }

    // [watchMovie]
    public void WatchMovie(string movie)
    {
        _screen.Down();
        _projector.On();
        _projector.WideScreenMode();
        _amp.On();
        _amp.SetVolume(5);
        _dvd.Play(movie);
    }
    // [/watchMovie]
}
// [/facade]
