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
    Action Execute();
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
    public Action Execute()
    {
        var wasOn = light.On;
        light.TurnOn();
        return () =>
        {
            if (!wasOn) light.TurnOff();
        };
    }
}
// [/onCommand]

// [offCommand]
class LightOffCommand(Light light) : ICommand
{
    public Action Execute()
    {
        var wasOn = light.On;
        light.TurnOff();
        return () =>
        {
            if (wasOn) light.TurnOn();
        };
    }
}
// [/offCommand]

// [remote]
class RemoteButton
{
    private ICommand? _current;
    private readonly List<Action> _history = new();

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
        _history.Add(_current.Execute());
    }
    // [/execute]

    // [undo]
    public void UndoLast()
    {
        if (_history.Count == 0) return;
        var undo = _history[^1];
        _history.RemoveAt(_history.Count - 1);
        undo();
    }
    // [/undo]
}
// [/remote]
