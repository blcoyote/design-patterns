// Usage
// [createCommands]
var light = new Light();
var on = new LightOnCommand(light);
var off = new LightOffCommand(light);
// [/createCommands]

var remote = new RemoteButton();

remote.SetCommand(on);
remote.Press(); // light turns on, pushed onto history

remote.SetCommand(off);
remote.Press(); // light turns off, pushed onto history

remote.UndoLast(); // pops LightOffCommand, calls Undo() -> light turns back on

// [command]
interface ICommand
{
    bool Execute();
    void Undo(bool wasOn);
}
// [/command]

// [light]
class Light
{
    public bool On { get; private set; }

    public void TurnOn()
    {
        On = true;
        Console.WriteLine("light: on");
    }

    public void TurnOff()
    {
        On = false;
        Console.WriteLine("light: off");
    }
}
// [/light]

// [onCommand]
class LightOnCommand(Light light) : ICommand
{
    public bool Execute()
    {
        var wasOn = light.On;
        light.TurnOn();
        return wasOn;
    }

    public void Undo(bool wasOn)
    {
        if (!wasOn) light.TurnOff();
    }
}
// [/onCommand]

// [offCommand]
class LightOffCommand(Light light) : ICommand
{
    public bool Execute()
    {
        var wasOn = light.On;
        light.TurnOff();
        return wasOn;
    }

    public void Undo(bool wasOn)
    {
        if (wasOn) light.TurnOn();
    }
}
// [/offCommand]

// [remote]
class RemoteButton
{
    private ICommand? _current;
    private readonly List<(ICommand Command, bool WasOn)> _history = new();

    // [setCommand]
    public void SetCommand(ICommand command)
    {
        _current = command;
    }
    // [/setCommand]

    // [execute]
    public void Press()
    {
        if (_current is null) return;
        var wasOn = _current.Execute();
        _history.Add((_current, wasOn));
    }
    // [/execute]

    // [undo]
    public void UndoLast()
    {
        if (_history.Count == 0) return;
        var (command, wasOn) = _history[^1];
        _history.RemoveAt(_history.Count - 1);
        command.Undo(wasOn);
    }
    // [/undo]
}
// [/remote]
