from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Callable, Union


# [model]
# The entire application state, as one immutable value. Nothing outside update()
# is ever allowed to mutate a Model - frozen=True makes that a runtime guarantee,
# and a new Model is always a new object.
@dataclass(frozen=True)
class Todo:
    id: int
    text: str
    done: bool


@dataclass(frozen=True)
class Model:
    todos: tuple[Todo, ...]
    next_id: int
    last_saved: int | None
# [/model]


# [msg]
# Messages are data describing intent, not method calls - the Command pattern's
# "encapsulate a request as an object" taken to its logical extreme. The client
# never calls a method on the model; it builds one of these and dispatches it.
@dataclass(frozen=True)
class Add:
    text: str


@dataclass(frozen=True)
class Toggle:
    id: int


@dataclass(frozen=True)
class Saved:
    id: int


Msg = Union[Add, Toggle, Saved]


# A Cmd is likewise a description of an effect to perform, not the effect
# itself. update() never touches the outside world - it only ever returns Cmds
# for the runtime to carry out.
@dataclass(frozen=True)
class Save:
    id: int


Cmd = Union[Save]
# [/msg]


# [update]
def update(model: Model, msg: Msg) -> tuple[Model, tuple[Cmd, ...]]:
    """The pure core: (model, msg) -> (model, cmds). Same inputs, same outputs,
    forever. No I/O, no randomness, no clock - an explicit state machine (every
    Msg maps to exactly one transition) with the transition function made a
    first-class value."""
    match msg:
        case Add(text=text):
            todo = Todo(id=model.next_id, text=text, done=False)
            next_model = replace(model, todos=model.todos + (todo,), next_id=model.next_id + 1)
            return next_model, (Save(id=todo.id),)
        case Toggle(id=todo_id):
            todos = tuple(replace(t, done=not t.done) if t.id == todo_id else t for t in model.todos)
            return replace(model, todos=todos), ()
        case Saved(id=saved_id):
            return replace(model, last_saved=saved_id), ()
    raise ValueError("unknown message")
# [/update]


# [view]
def view(model: Model) -> str:
    """The other pure function: model -> rendered text. No I/O - view() only
    ever builds a string; the runtime decides what to do with it."""
    lines = [f"[{'x' if t.done else ' '}] {t.text}" for t in model.todos]
    saved = f"saved #{model.last_saved}" if model.last_saved is not None else "saved: none yet"
    return "\n".join([*lines, f"({saved})"])
# [/view]


# [runtime]
class Runtime:
    """The imperative shell: a tiny loop that dispatches messages, calls the
    pure update(), keeps every resulting model in history (what makes
    time-travel possible), renders + notifies after every change, and only then
    performs whatever Cmds came back. It is the only part of the program that does
    anything impure."""

    def __init__(self, initial: Model) -> None:
        self._history: list[Model] = [initial]
        self._cursor = 0
        self._subscribers: list[Callable[[str], None]] = []

    @property
    def model(self) -> Model:
        return self._history[self._cursor]

    @property
    def history_length(self) -> int:
        return len(self._history)

    def subscribe(self, fn: Callable[[str], None]) -> None:
        self._subscribers.append(fn)

    def dispatch(self, msg: Msg) -> None:
        next_model, cmds = update(self.model, msg)
        # A dispatch after time-travel discards any history past the current
        # cursor, the same way Redux DevTools / Elm's debugger fork a new timeline.
        self._history = self._history[: self._cursor + 1] + [next_model]
        self._cursor = len(self._history) - 1
        self._notify()
        for cmd in cmds:
            self._perform(cmd)

    def _perform(self, cmd: Cmd) -> None:
        """The interpreter: walks each returned Cmd and performs the matching effect."""
        match cmd:
            case Save(id=todo_id):
                # A simulated save effect: synchronous and deterministic for this
                # demo, but in a real app this would be a network call whose
                # result arrives later.
                self.dispatch(Saved(id=todo_id))

    def time_travel(self, index: int) -> None:
        """Steps back to an earlier model without re-running update - pure time-travel."""
        self._cursor = index
        self._notify()

    def _notify(self) -> None:
        rendered = view(self.model)
        for sub in self._subscribers:
            sub(rendered)
# [/runtime]


# [usage]
runtime = Runtime(Model(todos=(), next_id=1, last_saved=None))
runtime.subscribe(lambda rendered: print("--- view ---\n" + rendered))

runtime.dispatch(Add(text="Buy milk"))
runtime.dispatch(Toggle(id=1))

print(f"history length: {runtime.history_length}")

runtime.time_travel(0)
# [/usage]
