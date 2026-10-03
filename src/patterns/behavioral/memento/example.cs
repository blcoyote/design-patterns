// Usage (top-level statements must come before type declarations)
// [client]
var editor = new TextEditor();
var shelf = new HistoryShelf();

editor.Type("Hello");
shelf.Push(editor.Save()); // checkpoint #1: "Hello"

editor.Type(", world!");
Console.WriteLine(editor.Text); // "Hello, world!"

editor.Restore(shelf.Pop()!); // undo back to checkpoint #1
Console.WriteLine(editor.Text); // "Hello"
// [/client]

// [memento]
// EditorMemento exposes nothing publicly, not even a getter. The real state
// lives in a private nested class inside TextEditor (ConcreteMemento below),
// so only TextEditor can see its fields — HistoryShelf has no way to peek
// inside a memento even if it wanted to, it only ever shuffles tokens.
abstract class EditorMemento { }
// [/memento]

// [editor]
class TextEditor
{
    private string _content = "";

    // Private to TextEditor: nothing else can construct one, inspect its
    // fields, or even downcast to it.
    private sealed class ConcreteMemento(string content) : EditorMemento
    {
        public string Content { get; } = content;
    }

    // [type]
    public void Type(string text)
    {
        _content += text;
    }
    // [/type]

    // [save]
    public EditorMemento Save()
    {
        return new ConcreteMemento(_content);
    }
    // [/save]

    // [restore]
    public void Restore(EditorMemento memento)
    {
        // [getState]
        _content = ((ConcreteMemento)memento).Content;
        // [/getState]
    }
    // [/restore]

    public string Text => _content;
}
// [/editor]

// [history]
class HistoryShelf
{
    // Typed as a stack of EditorMemento — an opaque handle, never read, only shuffled.
    private readonly Stack<EditorMemento> _shelf = new();

    // [push]
    public void Push(EditorMemento memento)
    {
        _shelf.Push(memento);
    }
    // [/push]

    // [pop]
    public EditorMemento? Pop()
    {
        return _shelf.Count > 0 ? _shelf.Pop() : null;
    }
    // [/pop]
}
// [/history]
