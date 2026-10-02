import type { PatternDefinition } from '@/types/pattern'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import { MementoVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'memento',
  name: 'Memento',
  category: 'behavioral',
  order: 9,
  summary: 'Capture and restore an object’s private state without ever exposing it.',
  intent:
    'Without violating encapsulation, capture and externalize an object’s internal state so that it can be restored to that state later.',
  problem:
    'An undo feature needs to save an object’s internal state so it can roll back to it later. The obvious fix — adding public getters and setters so some outside "history" manager can read and later rewrite that state — breaks encapsulation, and invites every other part of the program to depend on internals that were never meant to be public.',
  solution:
    'Let the object itself (the Originator) produce an opaque Memento capturing its own state, and hand that memento to a Caretaker whose only job is to store and return it — never to look inside. When a rollback is needed, the Caretaker hands the memento back, and only the Originator knows how to unpack and restore from it.',
  analogy:
    'A video game’s save file: the game writes it, and only the game knows how to load it back. Your file system — the caretaker — happily stores and hands back the file on request, with no idea, and no need to know, what is inside it.',
  whenToUse: [
    'You need undo/redo, checkpoints, or rollback for an object’s internal state.',
    'A direct snapshot would otherwise require exposing private fields through public getters and setters.',
    'You want a history mechanism (the caretaker) that stays completely decoupled from exactly what it is storing.',
  ],
  pros: [
    'Preserves encapsulation — only the originator ever reads or writes its own state.',
    'Simplifies the originator: it just produces and consumes snapshots, instead of tracking its own history.',
    'A caretaker can manage any number of mementos (a stack, a timeline, branches) without knowing their contents.',
  ],
  cons: [
    'Storing many large mementos can be expensive if snapshots are not kept small or incremental.',
    'Caretakers must still manage memento lifetimes carefully — an unbounded history can leak memory.',
    'Languages without true private members need another idiom (e.g. a package-private accessor) to keep the memento genuinely opaque.',
  ],
  realWorld: [
    'Undo/redo stacks in text editors and image editors (Ctrl+Z / Ctrl+Shift+Z)',
    'Database transaction savepoints and rollback (memento-like, though usually implemented at a lower level)',
    'Git commits — memento-like immutable snapshots a working tree can be reset back to',
    'Game save states and level checkpoints',
  ],
  related: ['command', 'prototype', 'state'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 110,
      y: 230,
      description:
        'Drives the demo: tells the editor to type and to save, then later to undo — all without ever knowing what a Memento looks like on the inside.',
    },
    {
      id: 'editor',
      label: 'TextEditor',
      role: 'Originator',
      kind: 'class',
      x: 350,
      y: 230,
      description:
        'Owns the real document content. save() packages that private state into a brand-new EditorMemento; restore() unpacks one back into itself. Nothing else can read or write content directly.',
    },
    {
      id: 'memento',
      label: 'EditorMemento',
      role: 'Memento',
      kind: 'class',
      x: 620,
      y: 110,
      description:
        'A sealed snapshot of the editor’s content at one moment in time. It exposes no accessors at all — its content is sealed where only TextEditor can read it (a module-private WeakMap in TypeScript, a private nested class in C#), so even HistoryShelf has no way to peek inside.',
    },
    {
      id: 'history',
      label: 'HistoryShelf',
      role: 'Caretaker',
      kind: 'class',
      x: 620,
      y: 350,
      description:
        'Keeps mementos on a stack (push/pop) purely as opaque tokens. It can tell you how many snapshots it is holding, but never what any of them contain.',
    },
  ],
  relations: [
    {
      id: 'client-type',
      from: 'client',
      to: 'editor',
      type: 'calls',
      label: 'type(text)',
      description: 'The client tells the editor to append text. TextEditor is the only thing that ever touches its own content field.',
      code: 'type',
    },
    {
      id: 'client-save',
      from: 'client',
      to: 'editor',
      type: 'calls',
      label: 'save()',
      description: 'The client asks the editor to checkpoint itself, with no idea how the resulting snapshot will be represented.',
      bend: -34,
      code: 'save',
    },
    {
      id: 'client-restore',
      from: 'client',
      to: 'editor',
      type: 'calls',
      label: 'restore(memento)',
      description: 'The client hands a previously-popped memento straight back to the editor — it is only ever a courier, never a reader.',
      bend: 34,
      code: 'restore',
    },
    {
      id: 'editor-create',
      from: 'editor',
      to: 'memento',
      type: 'creates',
      label: '⇒ Memento',
      description: 'save() constructs a new EditorMemento around the current content and returns it — the memento is born already sealed.',
      bend: -24,
      code: 'save',
    },
    {
      id: 'editor-read',
      from: 'editor',
      to: 'memento',
      type: 'calls',
      label: 'unseal()',
      description: 'Inside restore(), TextEditor is the only code that can unseal the memento (via the module-private WeakMap in TS, or by casting to its private nested ConcreteMemento in C#), recovering the content it sealed away earlier.',
      bend: 24,
      code: 'getState',
    },
    {
      id: 'client-push',
      from: 'client',
      to: 'history',
      type: 'calls',
      label: 'push(memento)',
      description: 'The client stores the returned memento on the shelf; HistoryShelf.push() never inspects what it is given.',
      bend: -34,
      code: 'push',
    },
    {
      id: 'client-pop',
      from: 'client',
      to: 'history',
      type: 'calls',
      label: 'pop()',
      description: 'Undo starts here: the client asks the shelf for the most recently saved memento back.',
      bend: 34,
      code: 'pop',
    },
    {
      id: 'history-holds',
      from: 'history',
      to: 'memento',
      type: 'holds',
      label: 'shelf: Memento[]',
      description:
        'HistoryShelf keeps its stack typed only as EditorMemento[] — an opaque handle, not the content itself. This is what keeps the caretaker completely decoupled from the originator’s internals.',
      code: 'history',
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'A fresh document',
      description: 'TextEditor starts with empty content, and HistoryShelf starts empty too — nothing has been checkpointed yet.',
      highlight: ['editor', 'history'],
      notes: { editor: 'content: ""', history: 'shelf: 0' },
      code: 'editor',
    },
    {
      title: 'The author types',
      description: 'The client calls editor.type("Hello"), appending straight onto the editor’s private content field.',
      highlight: ['client', 'client-type', 'editor'],
      packets: [{ relation: 'client-type', label: 'type("Hello")' }],
      notes: { editor: 'content: "Hello"' },
      code: 'type',
    },
    {
      title: 'A checkpoint is captured',
      description:
        'editor.save() packages the current content into a brand-new EditorMemento. Only TextEditor knows how to construct or read one — to everyone else it is opaque.',
      highlight: ['client', 'client-save', 'editor', 'editor-create', 'memento'],
      packets: [
        { relation: 'client-save', label: 'save()' },
        { relation: 'editor-create', label: '⇒ Memento' },
      ],
      notes: { memento: '"Hello"' },
      code: 'save',
    },
    {
      title: 'The caretaker files it away',
      description:
        'The client hands the memento to shelf.push(). The shelf stores the object on its stack without ever calling a method that would reveal what is inside it.',
      highlight: ['client', 'client-push', 'history', 'history-holds', 'memento'],
      packets: [{ relation: 'client-push', label: 'push(memento)' }],
      notes: { history: 'shelf: 1' },
      code: 'push',
    },
    {
      title: 'More edits pile up',
      description:
        'The author keeps typing: editor.type(", world!"). The content changes, but the checkpoint already sitting on the shelf is untouched — mementos are immutable snapshots.',
      highlight: ['client', 'client-type', 'editor'],
      packets: [{ relation: 'client-type', label: 'type(", world!")' }],
      notes: { editor: 'content: "Hello, world!"' },
      code: 'type',
    },
    {
      title: 'Undo: the shelf hands back the last checkpoint',
      description:
        'The client calls shelf.pop(). The most recently saved memento comes back off the stack — still sealed, still unread by the caretaker.',
      highlight: ['client', 'client-pop', 'history', 'history-holds', 'memento'],
      packets: [{ relation: 'client-pop', label: '⇒ memento', reverse: true }],
      notes: { history: 'shelf: 0' },
      code: 'pop',
    },
    {
      title: 'The editor restores itself',
      description:
        'The client calls editor.restore(memento). Only now, inside restore(), does TextEditor unseal the memento — something only it can do — and overwrite its own content with it.',
      highlight: ['client', 'client-restore', 'editor', 'editor-read', 'memento'],
      packets: [
        { relation: 'client-restore', label: 'restore(memento)' },
        { relation: 'editor-read', label: 'unseal()' },
      ],
      notes: { editor: 'content: "Hello"' },
      code: 'restore',
    },
    {
      title: 'Encapsulation, intact',
      description:
        'HistoryShelf stored and returned a memento without ever having any way to read its content; only TextEditor — the originator — can unseal it. That narrow interface is the whole pattern.',
      highlight: ['memento', 'editor-read', 'history'],
      notes: { memento: 'sealed', history: 'never peeks' },
      code: 'memento',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,

  Visualization: MementoVisualization,
}
