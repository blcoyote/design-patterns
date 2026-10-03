// [usage]
// Usage — widgets are only ever handed the mediator, never each other
var dialog = new LoginDialog();

dialog.Username.Type("ada"); // submit: enabled = true
dialog.Checkbox.Toggle(); // password: focused
// [/usage]

// [mediatorIface]
// A marker interface every widget satisfies, so the mediator can accept
// "some colleague" without depending on any concrete widget class.
interface IColleague { }

interface IMediator
{
    void Notify(IColleague sender, string @event);
}
// [/mediatorIface]

// [dialog]
class LoginDialog : IMediator
{
    // [holds]
    // Exposed read-only so a caller can drive the demo widgets directly
    // (dialog.Username.Type(...)) — the dialog still owns construction and
    // wiring, which is all Mediator actually requires.
    public UsernameField Username { get; }
    public PasswordField Password { get; }
    public RememberMeCheckbox Checkbox { get; }
    public SubmitButton Submit { get; }
    // [/holds]

    public LoginDialog()
    {
        Username = new UsernameField(this);
        Password = new PasswordField(this);
        Checkbox = new RememberMeCheckbox(this);
        Submit = new SubmitButton(this);
    }

    // [notify]
    public void Notify(IColleague sender, string @event)
    {
        if (sender == Username && @event == "changed")
        {
            // [enable]
            Submit.SetEnabled(Username.Value.Length > 0);
            // [/enable]
        }
        if (sender == Checkbox && @event == "toggled")
        {
            // [focus]
            if (Checkbox.Checked) Password.Focus();
            // [/focus]
        }
    }
    // [/notify]
}
// [/dialog]

// [username]
class UsernameField(IMediator mediator) : IColleague
{
    public string Value { get; private set; } = "";

    public void Type(string value)
    {
        Value = value;
        mediator.Notify(this, "changed");
    }
}
// [/username]

// [password]
class PasswordField : IColleague
{
    // No use for the mediator yet — Focus() is only ever called by the
    // dialog itself — but every colleague accepts one for consistency.
    public PasswordField(IMediator mediator) { }

    public void Focus()
    {
        Console.WriteLine("password: focused");
    }
}
// [/password]

// [checkbox]
class RememberMeCheckbox(IMediator mediator) : IColleague
{
    public bool Checked { get; private set; }

    public void Toggle()
    {
        Checked = !Checked;
        mediator.Notify(this, "toggled");
    }
}
// [/checkbox]

// [submit]
class SubmitButton : IColleague
{
    // No use for the mediator yet — SetEnabled() is only ever called by the
    // dialog itself — but every colleague accepts one for consistency.
    public SubmitButton(IMediator mediator) { }

    public bool Enabled { get; private set; }

    public void SetEnabled(bool enabled)
    {
        Enabled = enabled;
        // C# would print a bool as "True"; lowercase it to match the other tabs.
        Console.WriteLine($"submit: enabled = {(enabled ? "true" : "false")}");
    }
}
// [/submit]
