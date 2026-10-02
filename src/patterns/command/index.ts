import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'command',
  name: 'Command',
  category: 'behavioral',
  order: 3,
  summary: 'Turn a request into a standalone object you can queue, log, or undo.',
  intent: 'Encapsulate a request as an object, letting you parameterize clients with different requests, queue them, log them, and support undo.',
  problem:
    'A remote control button needs to turn a light on, but it should not need to know anything about Light directly — the same button widget is reused for lights, fans, and locks. On top of that, pressing the button should be undoable, and every press should be recorded in a history.',
  solution:
    'Wrap each request in a Command object with execute() and undo() methods. The Invoker (the button) only ever calls execute() on whatever Command it is holding, pushing it onto a history stack; undo() pops the stack and reverses the effect — all without the invoker knowing what the command actually does.',
  analogy:
    'A restaurant order slip. The waiter (invoker) does not cook — they just hand the slip (command) to the kitchen (receiver). The slip can be queued, handed to any cook, or crossed out and remade, all without the waiter understanding how any dish is prepared.',
  whenToUse: [
    'You want to parameterize UI elements (buttons, menu items) with an action to perform.',
    'You need undo/redo, queuing, or logging of operations.',
    'You want to decouple the object that invokes an operation from the object that knows how to perform it.',
  ],
  pros: [
    'Decouples the invoker from the receiver — neither needs to know about the other.',
    'Commands can be queued, logged, serialized, or combined into macros.',
    'Undo/redo falls out naturally from storing executed commands.',
  ],
  cons: [
    'Introduces a class (or object) for every distinct action, which adds boilerplate.',
    'Undo logic must be written and kept in sync with each command’s execute() by hand.',
    'A long-lived history of commands can consume memory if never trimmed.',
  ],
  realWorld: [
    'Undo/redo stacks in text editors and design tools',
    'Task queues and job schedulers (each job is a serialized command)',
    'GUI menu items and toolbar buttons bound to an action object',
    'Redux actions dispatched to a store, replayed for time-travel debugging',
  ],
  related: ['chain-of-responsibility', 'observer', 'strategy', 'prototype'],
  participants: [
    {
      id: 'command',
      label: 'Command',
      role: 'Command interface',
      kind: 'interface',
      x: 400,
      y: 60,
      description: 'Declares execute() and undo(). The invoker only ever programs against this interface.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 130,
      y: 60,
      description: 'Creates the concrete commands, binding each one to the receiver it should act on, and hands them to the invoker.',
      code: 'createCommands',
    },
    {
      id: 'remote',
      label: 'RemoteButton',
      role: 'Invoker',
      kind: 'class',
      x: 400,
      y: 230,
      width: 170,
      description: 'Holds the current command and a history stack. press() calls execute() and records it; undoLast() pops the stack and calls undo().',
    },
    {
      id: 'onCommand',
      label: 'LightOnCommand',
      role: 'Concrete Command',
      kind: 'class',
      x: 660,
      y: 140,
      description: 'Binds to a specific Light. execute() turns it on; undo() reverses that by turning it back off.',
    },
    {
      id: 'offCommand',
      label: 'LightOffCommand',
      role: 'Concrete Command',
      kind: 'class',
      x: 660,
      y: 320,
      description: 'Binds to a specific Light. execute() turns it off; undo() reverses that by turning it back on.',
    },
    {
      id: 'light',
      label: 'Light',
      role: 'Receiver',
      kind: 'class',
      x: 400,
      y: 380,
      width: 150,
      description: 'Knows how to actually turn itself on and off. It has no idea that a Command or a RemoteButton exists.',
    },
  ],
  relations: [
    {
      id: 'holds',
      from: 'remote',
      to: 'command',
      type: 'holds',
      label: 'history[]',
      description: 'The invoker stores commands typed only as Command — both in its "current" slot and its history stack.',
      code: 'remote',
    },
    { id: 'on-impl', from: 'onCommand', to: 'command', type: 'implements', description: 'LightOnCommand implements Command.' },
    { id: 'off-impl', from: 'offCommand', to: 'command', type: 'implements', description: 'LightOffCommand implements Command.', bend: 30 },
    {
      id: 'create-on',
      from: 'client',
      to: 'onCommand',
      type: 'creates',
      label: 'new LightOnCommand(light)',
      description: 'The client creates a LightOnCommand bound to a specific Light instance.',
      code: 'createCommands',
    },
    {
      id: 'create-off',
      from: 'client',
      to: 'offCommand',
      type: 'creates',
      label: 'new LightOffCommand(light)',
      description: 'The client creates a LightOffCommand bound to the same Light instance.',
      bend: -20,
      code: 'createCommands',
    },
    {
      id: 'bind',
      from: 'client',
      to: 'remote',
      type: 'calls',
      label: 'setCommand()',
      description: 'The client hands a command to the remote, which stores it as the current command to run on the next press.',
      code: 'setCommand',
    },
    {
      id: 'press-on',
      from: 'remote',
      to: 'onCommand',
      type: 'calls',
      label: 'execute()',
      description: 'Pressing the button calls execute() on whichever command is currently loaded.',
      code: 'execute',
    },
    {
      id: 'press-off',
      from: 'remote',
      to: 'offCommand',
      type: 'calls',
      label: 'execute()',
      description: 'Pressing the button calls execute() on whichever command is currently loaded.',
      code: 'execute',
    },
    {
      id: 'on-effect',
      from: 'onCommand',
      to: 'light',
      type: 'calls',
      label: 'turnOn()',
      description: 'LightOnCommand’s execute() calls turnOn() on its receiver; its undo() calls turnOff() on the same receiver.',
    },
    {
      id: 'off-effect',
      from: 'offCommand',
      to: 'light',
      type: 'calls',
      label: 'turnOff()',
      description: 'LightOffCommand’s execute() calls turnOff() on its receiver; its undo() calls turnOn() on the same receiver.',
    },
  ],
  steps: [
    {
      title: 'Client wires up commands',
      description: 'The client creates one command per action, each bound to the same Light. Neither command nor light knows about the remote yet.',
      highlight: ['client', 'create-on', 'create-off', 'light'],
      notes: { onCommand: 'bound', offCommand: 'bound' },
      code: 'createCommands',
    },
    {
      title: 'Remote stores the command',
      description: 'The client loads LightOnCommand into the remote. The remote only knows it holds "a Command" — not which one.',
      highlight: ['bind', 'remote'],
      notes: { remote: 'current: On' },
      code: 'setCommand',
    },
    {
      title: 'Button press executes it',
      description: 'Pressing the button calls execute() on the current command, which calls turnOn() on the light it was bound to.',
      highlight: ['remote', 'press-on', 'on-effect', 'light'],
      packets: [
        { relation: 'press-on', label: 'execute()' },
        { relation: 'on-effect', label: 'turnOn()' },
      ],
      notes: { light: 'on', remote: 'history: 1' },
      code: 'execute',
    },
    {
      title: 'Swap command and press again',
      description: 'The client loads LightOffCommand instead and presses again. The remote’s press() logic never changes.',
      highlight: ['bind', 'remote', 'press-off', 'off-effect', 'light'],
      packets: [
        { relation: 'press-off', label: 'execute()' },
        { relation: 'off-effect', label: 'turnOff()' },
      ],
      notes: { light: 'off', remote: 'history: 2' },
      code: 'execute',
    },
    {
      title: 'Undo reverses the last command',
      description: 'undoLast() pops LightOffCommand from the history and calls its undo(), which calls turnOn() — reversing the last press exactly.',
      highlight: ['remote', 'off-effect', 'light'],
      packets: [{ relation: 'off-effect', label: 'undo(): turnOn()', reverse: true }],
      notes: { remote: 'history: 1', light: 'on' },
      code: 'undo',
    },
  ],
  code: `
// [command]
interface Command {
  execute(): void
  undo(): void
}
// [/command]

// [light]
class Light {
  private isOn = false

  turnOn() {
    this.isOn = true
    console.log('light: on')
  }

  turnOff() {
    this.isOn = false
    console.log('light: off')
  }
}
// [/light]

// [onCommand]
class LightOnCommand implements Command {
  constructor(private light: Light) {}

  execute() {
    this.light.turnOn()
  }

  undo() {
    this.light.turnOff()
  }
}
// [/onCommand]

// [offCommand]
class LightOffCommand implements Command {
  constructor(private light: Light) {}

  execute() {
    this.light.turnOff()
  }

  undo() {
    this.light.turnOn()
  }
}
// [/offCommand]

// [remote]
class RemoteButton {
  private current: Command | null = null
  private history: Command[] = []

  // [setCommand]
  setCommand(command: Command) {
    this.current = command
  }
  // [/setCommand]

  // [execute]
  press() {
    if (!this.current) return
    this.current.execute()
    this.history.push(this.current)
  }
  // [/execute]

  // [undo]
  undoLast() {
    const command = this.history.pop()
    command?.undo()
  }
  // [/undo]
}
// [/remote]

// Usage
// [createCommands]
const light = new Light()
const on = new LightOnCommand(light)
const off = new LightOffCommand(light)
// [/createCommands]

const remote = new RemoteButton()

remote.setCommand(on)
remote.press() // light turns on, pushed onto history

remote.setCommand(off)
remote.press() // light turns off, pushed onto history

remote.undoLast() // pops LightOffCommand, calls undo() -> light turns back on
`,
}
