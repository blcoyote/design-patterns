package main

import "fmt"

// [memento]
// EditorMemento exposes nothing publicly, not even a getter: its content is
// an unexported field, so another package could only shuffle the token
// around, never read it. Go scopes unexported names to the whole package, and
// this single-file demo is all one `package main`, so here HistoryShelf could
// technically read it too. In a real project the memento and TextEditor would
// share a package, and HistoryShelf would live in another one.
type EditorMemento struct {
	content string
}

// [/memento]

// [editor]
type TextEditor struct {
	content string
}

// [type]
func (e *TextEditor) Type(text string) {
	e.content += text
}

// [/type]

// [save]
func (e *TextEditor) Save() *EditorMemento {
	// The memento gets its own copy of the content; Go strings are immutable,
	// so later edits to the editor can never change it.
	return &EditorMemento{content: e.content}
}

// [/save]

// [restore]
func (e *TextEditor) Restore(memento *EditorMemento) {
	// [getState]
	e.content = memento.content
	// [/getState]
}

// [/restore]

func (e *TextEditor) Text() string {
	return e.content
}

// [/editor]

// [history]
type HistoryShelf struct {
	// An opaque stack of mementos — never read, only shuffled.
	shelf []*EditorMemento
}

// [push]
func (h *HistoryShelf) Push(memento *EditorMemento) {
	h.shelf = append(h.shelf, memento)
}

// [/push]

// [pop]
func (h *HistoryShelf) Pop() *EditorMemento {
	if len(h.shelf) == 0 {
		return nil
	}
	memento := h.shelf[len(h.shelf)-1]
	h.shelf = h.shelf[:len(h.shelf)-1]
	return memento
}

// [/pop]
// [/history]

func main() {
	// [client]
	// Usage
	editor := &TextEditor{}
	shelf := &HistoryShelf{}

	editor.Type("Hello")
	shelf.Push(editor.Save()) // checkpoint #1: "Hello"

	editor.Type(", world!")
	fmt.Println(editor.Text()) // "Hello, world!"

	restored := shelf.Pop()
	editor.Restore(restored)   // undo back to checkpoint #1
	fmt.Println(editor.Text()) // "Hello"
	// [/client]
}
