from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


# [model]
class TodoView:
    """Observer protocol: Views register themselves and are notified on every Model change."""

    def update(self, model: "TodoModel") -> None:
        raise NotImplementedError


@dataclass
class Todo:
    id: int
    text: str
    done: bool = False


class TodoModel:
    def __init__(self) -> None:
        self._todos: list[Todo] = []
        self._observers: list[TodoView] = []
        self._next_id = 1

    def subscribe(self, view: TodoView) -> None:
        self._observers.append(view)

    def add_todo(self, text: str) -> None:
        self._todos.append(Todo(self._next_id, text))
        self._next_id += 1
        self._notify()

    def toggle_todo(self, todo_id: int) -> None:
        todo = next((t for t in self._todos if t.id == todo_id), None)
        if todo is None:
            raise ValueError(f"no such todo: {todo_id}")
        todo.done = not todo.done
        self._notify()

    @property
    def all(self) -> list[Todo]:
        return self._todos

    @property
    def remaining(self) -> int:
        return sum(1 for t in self._todos if not t.done)

    def _notify(self) -> None:
        # Notify a snapshot of observers, not the live list, so a view that subscribes
        # or unsubscribes while handling an update can never skip or double-fire another.
        for observer in list(self._observers):
            observer.update(self)
# [/model]


# [command]
class Command:
    """Reifies a user action so the Controller can execute it uniformly."""

    def execute(self, model: TodoModel) -> None:
        raise NotImplementedError


class AddTodoCommand(Command):
    def __init__(self, text: str) -> None:
        self._text = text

    def execute(self, model: TodoModel) -> None:
        model.add_todo(self._text)


class ToggleTodoCommand(Command):
    def __init__(self, todo_id: int) -> None:
        self._todo_id = todo_id

    def execute(self, model: TodoModel) -> None:
        model.toggle_todo(self._todo_id)
# [/command]


# [controller]
class TodoInputController(Protocol):
    """Strategy: the interface TodoListView depends on. The View is typed against
    this, not against TodoController, so any implementation can be swapped in."""

    def handle_add_click(self, text: str) -> None: ...

    def handle_toggle_click(self, todo_id: int) -> None: ...


class TodoController:
    """Translates raw input into a Command run against the Model. It satisfies
    TodoInputController structurally (no explicit base class needed, per Python's
    Protocol), the Strategy the View is typed against, so a different implementation
    would handle the same click differently without the View changing at all."""

    def __init__(self, model: TodoModel) -> None:
        self._model = model

    def handle_add_click(self, text: str) -> None:
        AddTodoCommand(text).execute(self._model)

    def handle_toggle_click(self, todo_id: int) -> None:
        ToggleTodoCommand(todo_id).execute(self._model)
# [/controller]


# Composite: the shared component interface both the leaf and the composite
# implement, so TodoListView can treat every child uniformly through render().
class Renderable:
    def render(self) -> str:
        raise NotImplementedError


# [itemView]
class TodoItemView(Renderable):
    """Composite leaf: one rendered row, reached only through Renderable."""

    def __init__(self, todo: Todo) -> None:
        self._todo = todo

    def render(self) -> str:
        mark = "x" if self._todo.done else " "
        return f"[{mark}] {self._todo.text}"
# [/itemView]


# [listView]
class TodoListView(TodoView, Renderable):
    """View + Observer, and the Composite: holds a Renderable per todo and implements
    the same interface, so render() can join its children without caring that each
    one happens to be a TodoItemView."""

    def __init__(self) -> None:
        # Strategy: the View depends only on the TodoInputController protocol, so any
        # implementation can be swapped in without the View changing.
        self.controller: TodoInputController | None = None
        self._children: list[Renderable] = []

    def update(self, model: TodoModel) -> None:
        self._children = [TodoItemView(t) for t in model.all]
        print(f"[list] {self.render()}")

    def render(self) -> str:
        return ", ".join(child.render() for child in self._children) if self._children else "(empty)"

    def click_add(self, text: str) -> None:
        assert self.controller is not None
        self.controller.handle_add_click(text)

    def click_toggle(self, todo_id: int) -> None:
        assert self.controller is not None
        self.controller.handle_toggle_click(todo_id)
# [/listView]


# [countView]
class RemainingCountView(TodoView):
    """A second View subscribed to the same Model (Observer) — proof two Views can watch one Model."""

    def update(self, model: TodoModel) -> None:
        print(f"[count] {model.remaining} remaining")
# [/countView]


# [usage]
if __name__ == "__main__":
    model = TodoModel()
    controller = TodoController(model)

    list_view = TodoListView()
    list_view.controller = controller
    count_view = RemainingCountView()

    model.subscribe(list_view)
    model.subscribe(count_view)

    list_view.click_add("Buy milk")
    list_view.click_toggle(1)
# [/usage]
