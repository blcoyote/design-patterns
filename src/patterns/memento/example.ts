// [memento]
// EditorMemento exposes nothing publicly, not even a getter — TypeScript's
// `private` only blocks access at compile time, so a field would still be
// readable via (memento as any).content. Instead the content lives in a
// module-private WeakMap, keyed by the memento instance. Nothing outside
// this module can reach that map, so HistoryShelf has no way to read a
// memento's content even if it wanted to — it only ever shuffles tokens.
class EditorMemento {}

const mementoState = new WeakMap<EditorMemento, string>()
// [/memento]

// [editor]
class TextEditor {
  private content = ''

  // [type]
  type(text: string) {
    this.content += text
  }
  // [/type]

  // [save]
  save(): EditorMemento {
    const memento = new EditorMemento()
    mementoState.set(memento, this.content)
    return memento
  }
  // [/save]

  // [restore]
  restore(memento: EditorMemento) {
    // [getState]
    this.content = mementoState.get(memento)!
    // [/getState]
  }
  // [/restore]

  get text(): string {
    return this.content
  }
}
// [/editor]

// [history]
class HistoryShelf {
  // Typed as EditorMemento[] — an opaque stack, never read, only shuffled.
  private shelf: EditorMemento[] = []

  // [push]
  push(memento: EditorMemento) {
    this.shelf.push(memento)
  }
  // [/push]

  // [pop]
  pop(): EditorMemento | undefined {
    return this.shelf.pop()
  }
  // [/pop]
}
// [/history]

// [client]
// Usage
const editor = new TextEditor()
const shelf = new HistoryShelf()

editor.type('Hello')
shelf.push(editor.save()) // checkpoint #1: "Hello"

editor.type(', world!')
console.log(editor.text) // "Hello, world!"

editor.restore(shelf.pop()!) // undo back to checkpoint #1
console.log(editor.text) // "Hello"
// [/client]
