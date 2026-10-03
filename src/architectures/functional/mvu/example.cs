using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// [usage]
var runtime = new Runtime(new Model(Array.Empty<Todo>(), 1, null));
runtime.Subscribe(rendered => Console.WriteLine("--- view ---\n" + rendered));

runtime.Dispatch(new Add("Buy milk"));
runtime.Dispatch(new Toggle(1));

Console.WriteLine($"history length: {runtime.HistoryLength.ToString(CultureInfo.InvariantCulture)}");

runtime.TimeTravel(0);
// [/usage]

// [model]
// The entire application state, as one immutable value. Nothing outside Update
// is ever allowed to mutate a Model - a new Model is always a new record.
record Todo(int Id, string Text, bool Done);

record Model(IReadOnlyList<Todo> Todos, int NextId, int? LastSaved);
// [/model]

// [msg]
// Messages are data describing intent, not method calls - the Command pattern's
// "encapsulate a request as an object" taken to its logical extreme. The client
// never calls a method on the model; it builds one of these and dispatches it.
abstract record Msg;
record Add(string Text) : Msg;
record Toggle(int Id) : Msg;
record Saved(int Id) : Msg;

// A Cmd is likewise a description of an effect to perform, not the effect
// itself. Update never touches the outside world - it only ever returns Cmds
// for the runtime to carry out.
abstract record Cmd;
record Save(int Id) : Cmd;
// [/msg]

// [update]
static class Update
{
    /// <summary>
    /// The pure core: (model, msg) -> (model, cmds). Same inputs, same outputs,
    /// forever. No I/O, no randomness, no clock - an explicit state machine
    /// (every Msg maps to exactly one transition) with the transition function
    /// made a first-class value.
    /// </summary>
    public static (Model Next, IReadOnlyList<Cmd> Cmds) Apply(Model model, Msg msg)
    {
        switch (msg)
        {
            case Add add:
            {
                var todo = new Todo(model.NextId, add.Text, false);
                var next = model with { Todos = model.Todos.Append(todo).ToList(), NextId = model.NextId + 1 };
                return (next, new Cmd[] { new Save(todo.Id) });
            }
            case Toggle toggle:
            {
                var todos = model.Todos.Select(t => t.Id == toggle.Id ? t with { Done = !t.Done } : t).ToList();
                return (model with { Todos = todos }, Array.Empty<Cmd>());
            }
            case Saved saved:
                return (model with { LastSaved = saved.Id }, Array.Empty<Cmd>());
            default:
                throw new InvalidOperationException("unknown message");
        }
    }
}
// [/update]

// [view]
static class View
{
    /// <summary>
    /// The other pure function: model -> rendered text. No DOM, no console I/O -
    /// Render only ever builds a string; the runtime decides what to do with it.
    /// </summary>
    public static string Render(Model model)
    {
        var lines = model.Todos.Select(t => $"[{(t.Done ? "x" : " ")}] {t.Text}");
        var saved = model.LastSaved is { } id ? $"saved #{id.ToString(CultureInfo.InvariantCulture)}" : "saved: none yet";
        return string.Join("\n", lines.Append($"({saved})"));
    }
}
// [/view]

// [runtime]
/// <summary>
/// The imperative shell: a tiny loop that dispatches messages, calls the pure
/// Update, keeps every resulting model in history (what makes time-travel
/// possible), renders + notifies after every change, and only then performs
/// whatever Cmds came back. It is the only part of the program that does anything impure.
/// </summary>
class Runtime
{
    List<Model> _history;
    int _cursor;
    readonly List<Action<string>> _subscribers = new();

    public Runtime(Model initial)
    {
        _history = new List<Model> { initial };
        _cursor = 0;
    }

    public Model CurrentModel => _history[_cursor];
    public int HistoryLength => _history.Count;

    public void Subscribe(Action<string> fn) => _subscribers.Add(fn);

    public void Dispatch(Msg msg)
    {
        var (next, cmds) = Update.Apply(CurrentModel, msg);
        // A dispatch after time-travel discards any history past the current
        // cursor, the same way Redux DevTools / Elm's debugger fork a new timeline.
        _history = _history.Take(_cursor + 1).Append(next).ToList();
        _cursor = _history.Count - 1;
        Notify();
        foreach (var cmd in cmds) Perform(cmd);
    }

    // The interpreter: walks each returned Cmd and performs the matching effect.
    void Perform(Cmd cmd)
    {
        switch (cmd)
        {
            case Save save:
                // A simulated save effect: synchronous and deterministic for this
                // demo, but in a real app this would be a network call whose
                // result arrives later.
                Dispatch(new Saved(save.Id));
                break;
        }
    }

    // Steps back to an earlier model without re-running Update - pure time-travel.
    public void TimeTravel(int index)
    {
        _cursor = index;
        Notify();
    }

    void Notify()
    {
        var rendered = View.Render(CurrentModel);
        foreach (var sub in _subscribers) sub(rendered);
    }
}
// [/runtime]
