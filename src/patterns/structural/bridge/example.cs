// [usage]
// Usage
var remote = new RemoteControl(new TV());
remote.TogglePower(); // tv: on

remote.SetDevice(new Radio());
remote.TogglePower(); // radio: on

var advanced = new AdvancedRemoteControl(new TV());
advanced.TogglePower(); // tv: on
advanced.Mute(); // tv: volume 0%
// [/usage]

// [device]
interface IDevice
{
    bool IsOn { get; set; }
    int Volume { get; set; }
    void TurnOn();
    void TurnOff();
    void SetVolume(int percent);
}
// [/device]

// [tv]
class TV : IDevice
{
    public bool IsOn { get; set; } = false;
    public int Volume { get; set; } = 30;

    public void TurnOn()
    {
        IsOn = true;
        Console.WriteLine("tv: on");
    }
    public void TurnOff()
    {
        IsOn = false;
        Console.WriteLine("tv: off");
    }
    public void SetVolume(int percent)
    {
        Volume = percent;
        Console.WriteLine($"tv: volume {percent}%");
    }
}
// [/tv]

// [radio]
class Radio : IDevice
{
    public bool IsOn { get; set; } = false;
    public int Volume { get; set; } = 30;

    public void TurnOn()
    {
        IsOn = true;
        Console.WriteLine("radio: on");
    }
    public void TurnOff()
    {
        IsOn = false;
        Console.WriteLine("radio: off");
    }
    public void SetVolume(int percent)
    {
        Volume = percent;
        Console.WriteLine($"radio: volume {percent}%");
    }
}
// [/radio]

// [remoteControl]
class RemoteControl
{
    // [holds]
    protected IDevice Device;
    public RemoteControl(IDevice device)
    {
        Device = device;
    }
    // [/holds]

    // [togglePower]
    public void TogglePower()
    {
        if (Device.IsOn) Device.TurnOff();
        else Device.TurnOn();
    }
    // [/togglePower]

    // [setDevice]
    public void SetDevice(IDevice device)
    {
        Device = device;
    }
    // [/setDevice]
}
// [/remoteControl]

// [advancedRemote]
class AdvancedRemoteControl : RemoteControl
{
    public AdvancedRemoteControl(IDevice device) : base(device) { }

    // [mute]
    public void Mute()
    {
        Device.SetVolume(0);
    }
    // [/mute]
}
// [/advancedRemote]
