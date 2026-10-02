// Usage
// [usage]
// [client]
static string[] RenderDialog(IUiFactory factory)
{
    var button = factory.CreateButton();
    var checkbox = factory.CreateCheckbox();
    return [button.Render(), checkbox.Render()];
}
// [/client]

string GetUserTheme() => "dark"; // stand-in for a real preference lookup

var theme = GetUserTheme();
IUiFactory factory = theme == "dark" ? new DarkFactory() : new LightFactory();

Console.WriteLine(string.Join(", ", RenderDialog(factory))); // "button [dark], checkbox [dark]"

// Switch the whole family just by swapping the factory:
Console.WriteLine(string.Join(", ", RenderDialog(new LightFactory()))); // "button [light], checkbox [light]"
// [/usage]

// [button]
interface IButton
{
    string Render();
}
// [/button]

// [checkbox]
interface ICheckbox
{
    string Render();
}
// [/checkbox]

// [uiFactory]
interface IUiFactory
{
    IButton CreateButton();
    ICheckbox CreateCheckbox();
}
// [/uiFactory]

// [lightFactory]
class LightButton : IButton
{
    public string Render() => "button [light]";
}

class LightCheckbox : ICheckbox
{
    public string Render() => "checkbox [light]";
}

class LightFactory : IUiFactory
{
    public IButton CreateButton() => new LightButton();
    public ICheckbox CreateCheckbox() => new LightCheckbox();
}
// [/lightFactory]

// [darkFactory]
class DarkButton : IButton
{
    public string Render() => "button [dark]";
}

class DarkCheckbox : ICheckbox
{
    public string Render() => "checkbox [dark]";
}

class DarkFactory : IUiFactory
{
    public IButton CreateButton() => new DarkButton();
    public ICheckbox CreateCheckbox() => new DarkCheckbox();
}
// [/darkFactory]
