// [model]
/** Observer: Views register themselves and are notified whenever the Model's state changes. */
interface TodoView {
  update(model: TodoModel): void;
}

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

class TodoModel {
  private readonly todos: Todo[] = [];
  private readonly observers: TodoView[] = [];
  private nextId = 1;

  subscribe(view: TodoView): void {
    this.observers.push(view);
  }

  addTodo(text: string): void {
    this.todos.push({ id: this.nextId++, text, done: false });
    this.notify();
  }

  toggleTodo(id: number): void {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) throw new Error(`no such todo: ${id}`);
    todo.done = !todo.done;
    this.notify();
  }

  get all(): readonly Todo[] {
    return this.todos;
  }

  get remaining(): number {
    return this.todos.filter((t) => !t.done).length;
  }

  private notify(): void {
    // Notify a snapshot of observers, not the live array, so a view that subscribes
    // or unsubscribes while handling an update can never skip or double-fire another.
    for (const observer of [...this.observers]) observer.update(this);
  }
}
// [/model]

// [command]
/** Command: a user action reified as an object the Controller can execute uniformly. */
interface Command {
  execute(model: TodoModel): void;
}

class AddTodoCommand implements Command {
  constructor(private readonly text: string) {}
  execute(model: TodoModel): void {
    model.addTodo(this.text);
  }
}

class ToggleTodoCommand implements Command {
  constructor(private readonly id: number) {}
  execute(model: TodoModel): void {
    model.toggleTodo(this.id);
  }
}
// [/command]

// [controller]
/**
 * Strategy: the interface TodoListView depends on. The View is typed against this,
 * not against TodoController, so any implementation can be swapped in.
 */
interface TodoInputController {
  handleAddClick(text: string): void;
  handleToggleClick(id: number): void;
}

/**
 * Controller: translates raw input into a Command run against the Model. It
 * implements TodoInputController, the Strategy that the View is typed against, so
 * a different implementation would handle the same click differently without the
 * View changing at all.
 */
class TodoController implements TodoInputController {
  constructor(private readonly model: TodoModel) {}

  handleAddClick(text: string): void {
    new AddTodoCommand(text).execute(this.model);
  }

  handleToggleClick(id: number): void {
    new ToggleTodoCommand(id).execute(this.model);
  }
}
// [/controller]

// Composite: the shared component interface both the leaf and the composite
// implement, so TodoListView can treat every child uniformly through render().
interface Renderable {
  render(): string;
}

// [itemView]
/** Composite leaf: one rendered row, reached only through the Renderable interface. */
class TodoItemView implements Renderable {
  constructor(private readonly todo: Todo) {}

  render(): string {
    return `[${this.todo.done ? "x" : " "}] ${this.todo.text}`;
  }
}
// [/itemView]

// [listView]
/**
 * View + Observer, and the Composite: holds a Renderable per todo and implements
 * the same interface, so render() can join its children without caring that each
 * one happens to be a TodoItemView.
 */
class TodoListView implements TodoView, Renderable {
  // Strategy: the View depends only on the TodoInputController interface, so any
  // implementation can be swapped in without the View changing.
  controller!: TodoInputController;
  private children: Renderable[] = [];

  update(model: TodoModel): void {
    this.children = model.all.map((todo) => new TodoItemView(todo));
    console.log(`[list] ${this.render()}`);
  }

  render(): string {
    return this.children.length > 0
      ? this.children.map((child) => child.render()).join(", ")
      : "(empty)";
  }

  clickAdd(text: string): void {
    this.controller.handleAddClick(text);
  }

  clickToggle(id: number): void {
    this.controller.handleToggleClick(id);
  }
}
// [/listView]

// [countView]
/** A second View subscribed to the same Model (Observer) — proof two Views can watch one Model. */
class RemainingCountView implements TodoView {
  update(model: TodoModel): void {
    console.log(`[count] ${model.remaining} remaining`);
  }
}
// [/countView]

// [usage]
const model = new TodoModel();
const controller = new TodoController(model);

const listView = new TodoListView();
listView.controller = controller;
const countView = new RemainingCountView();

model.subscribe(listView);
model.subscribe(countView);

listView.clickAdd("Buy milk");
listView.clickToggle(1);
// [/usage]
