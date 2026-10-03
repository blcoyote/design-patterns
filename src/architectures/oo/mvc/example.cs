using System;
using System.Collections.Generic;
using System.Linq;

// [usage]
var model = new TodoModel();
var controller = new TodoController(model);

var listView = new TodoListView();
listView.Controller = controller;
var countView = new RemainingCountView();

model.Subscribe(listView);
model.Subscribe(countView);

listView.ClickAdd("Buy milk");
listView.ClickToggle(1);
// [/usage]

// [model]
// Observer: Views register themselves and are notified whenever the Model's state changes.
interface ITodoView
{
    void Update(TodoModel model);
}

class Todo
{
    public int Id { get; }
    public string Text { get; }
    public bool Done { get; set; }

    public Todo(int id, string text)
    {
        Id = id;
        Text = text;
        Done = false;
    }
}

class TodoModel
{
    private readonly List<Todo> _todos = new();
    private readonly List<ITodoView> _observers = new();
    private int _nextId = 1;

    public void Subscribe(ITodoView view) => _observers.Add(view);

    public void AddTodo(string text)
    {
        _todos.Add(new Todo(_nextId++, text));
        Notify();
    }

    public void ToggleTodo(int id)
    {
        var todo = _todos.FirstOrDefault(t => t.Id == id) ?? throw new InvalidOperationException($"no such todo: {id}");
        todo.Done = !todo.Done;
        Notify();
    }

    public IReadOnlyList<Todo> All => _todos;

    public int Remaining => _todos.Count(t => !t.Done);

    private void Notify()
    {
        // Notify a snapshot of observers, not the live list, so a view that subscribes
        // or unsubscribes while handling an update can never skip or double-fire another.
        foreach (var observer in _observers.ToList()) observer.Update(this);
    }
}
// [/model]

// [command]
// Command: a user action reified as an object the Controller can execute uniformly.
interface ICommand
{
    void Execute(TodoModel model);
}

class AddTodoCommand : ICommand
{
    private readonly string _text;
    public AddTodoCommand(string text) => _text = text;
    public void Execute(TodoModel model) => model.AddTodo(_text);
}

class ToggleTodoCommand : ICommand
{
    private readonly int _id;
    public ToggleTodoCommand(int id) => _id = id;
    public void Execute(TodoModel model) => model.ToggleTodo(_id);
}
// [/command]

// [controller]
// Strategy: the interface TodoListView depends on. The View is typed against this,
// not against TodoController, so any implementation can be swapped in.
interface ITodoInputController
{
    void HandleAddClick(string text);
    void HandleToggleClick(int id);
}

// Controller: translates raw input into a Command run against the Model. It
// implements ITodoInputController, the Strategy that the View is typed against, so
// a different implementation would handle the same click differently without the
// View changing at all.
class TodoController : ITodoInputController
{
    private readonly TodoModel _model;
    public TodoController(TodoModel model) => _model = model;

    public void HandleAddClick(string text) => new AddTodoCommand(text).Execute(_model);

    public void HandleToggleClick(int id) => new ToggleTodoCommand(id).Execute(_model);
}
// [/controller]

// Composite: the shared component interface both the leaf and the composite
// implement, so TodoListView can treat every child uniformly through Render().
interface IRenderable
{
    string Render();
}

// [itemView]
// Composite leaf: one rendered row, reached only through IRenderable.
class TodoItemView : IRenderable
{
    private readonly Todo _todo;
    public TodoItemView(Todo todo) => _todo = todo;

    public string Render() => $"[{(_todo.Done ? "x" : " ")}] {_todo.Text}";
}
// [/itemView]

// [listView]
// View + Observer, and the Composite: holds an IRenderable per todo and implements
// the same interface, so Render() can join its children without caring that each
// one happens to be a TodoItemView.
class TodoListView : ITodoView, IRenderable
{
    // Strategy: the View depends only on the ITodoInputController interface, so any
    // implementation can be swapped in without the View changing.
    public ITodoInputController Controller { get; set; } = null!;
    private List<IRenderable> _children = new();

    public void Update(TodoModel model)
    {
        _children = model.All.Select(t => (IRenderable)new TodoItemView(t)).ToList();
        Console.WriteLine($"[list] {Render()}");
    }

    public string Render() =>
        _children.Count > 0 ? string.Join(", ", _children.Select(c => c.Render())) : "(empty)";

    public void ClickAdd(string text) => Controller.HandleAddClick(text);

    public void ClickToggle(int id) => Controller.HandleToggleClick(id);
}
// [/listView]

// [countView]
// A second View subscribed to the same Model (Observer) — proof two Views can watch one Model.
class RemainingCountView : ITodoView
{
    public void Update(TodoModel model) => Console.WriteLine($"[count] {model.Remaining} remaining");
}
// [/countView]
