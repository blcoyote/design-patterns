import weakref


# [memento]
# EditorMemento exposes nothing publicly, not even a getter — Python has no
# true private fields, so a plain attribute would still be readable via
# memento._content. Instead the content lives in a module-private
# WeakKeyDictionary (Python's equivalent of a JS WeakMap), keyed by the
# memento instance. The leading underscore makes it private by convention
# only — Python can't enforce it — but the content is kept off the token
# itself, so HistoryShelf has no accessor to read it: it only ever
# shuffles tokens.
class EditorMemento:
    pass


_memento_state: "weakref.WeakKeyDictionary[EditorMemento, str]" = weakref.WeakKeyDictionary()
# [/memento]


# [editor]
class TextEditor:
    def __init__(self) -> None:
        self._content = ""

    # [type]
    def type(self, text: str) -> None:
        self._content += text
    # [/type]

    # [save]
    def save(self) -> EditorMemento:
        memento = EditorMemento()
        _memento_state[memento] = self._content
        return memento
    # [/save]

    # [restore]
    def restore(self, memento: EditorMemento) -> None:
        # [getState]
        self._content = _memento_state[memento]
        # [/getState]
    # [/restore]

    @property
    def text(self) -> str:
        return self._content
# [/editor]


# [history]
class HistoryShelf:
    def __init__(self) -> None:
        # Typed as a list of EditorMemento — an opaque stack, never read, only shuffled.
        self._shelf: list[EditorMemento] = []

    # [push]
    def push(self, memento: EditorMemento) -> None:
        self._shelf.append(memento)
    # [/push]

    # [pop]
    def pop(self) -> EditorMemento | None:
        return self._shelf.pop() if self._shelf else None
    # [/pop]
# [/history]


# [client]
# Usage
editor = TextEditor()
shelf = HistoryShelf()

editor.type("Hello")
shelf.push(editor.save())  # checkpoint #1: "Hello"

editor.type(", world!")
print(editor.text)  # "Hello, world!"

restored = shelf.pop()
assert restored is not None
editor.restore(restored)  # undo back to checkpoint #1
print(editor.text)  # "Hello"
# [/client]
