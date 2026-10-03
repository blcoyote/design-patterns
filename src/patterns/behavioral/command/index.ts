import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";

export const pattern: PatternDefinition = {
  slug: "command",
  name: "Command",
  category: "behavioral",
  order: 3,
  summary:
    "Turn a request into a standalone object you can queue, log, or undo.",
  intent:
    'Wrap a request in an object, so it can be queued, logged, passed around or undone like any other piece of data.',
  problem:
    "A remote-control button should turn a light on without knowing anything about Light. The same button widget is reused for lights, fans and locks. You also want every press to be undoable and recorded in a history.",
  solution:
    "Wrap each request in a Command object with execute() and undo() methods. The Invoker (the button) only calls execute() on whichever Command it currently holds, and pushes that command onto a history stack. undo() pops the stack and reverses the effect. The invoker never needs to know what the command actually does.",
  analogy:
    "Think of a restaurant order slip. The waiter (invoker) doesn't cook. They hand the slip (command) to the kitchen (receiver). The slip can be queued, given to any cook, or crossed out and remade, and the waiter never needs to understand how any dish is prepared.",
  whenToUse: [
    "You want to give UI elements such as buttons and menu items an action to perform, and be able to change that action.",
    "You need undo/redo, queuing, or logging of operations.",
    "You want to separate the object that triggers an operation from the object that knows how to perform it.",
  ],
  pros: [
    "Decouples the invoker from the receiver: neither needs to know about the other.",
    "Commands can be queued, logged, serialized, or combined into macros.",
    "Undo/redo comes almost for free once you keep the executed commands.",
  ],
  cons: [
    "Every distinct action needs its own class (or object), which adds boilerplate.",
    "A command can't just hard-code the opposite action as its undo(). It must remember whatever execute() is about to overwrite (for example the previous value) so undo() can restore it, and that is extra bookkeeping to keep in sync by hand.",
    "A long-lived history of commands uses more and more memory if you never trim it.",
  ],
  realWorld: [
    "Undo/redo stacks in text editors and design tools",
    "Task queues and job schedulers (each job is a serialized command)",
    "GUI menu items and toolbar buttons bound to an action object",
    "Redux-style serializable actions are Command-like in shape, but they carry no execute()/undo(). A reducer interprets them instead, which is what makes time-travel debugging possible.",
  ],
  related: [
    "chain-of-responsibility",
    "memento",
    "unit-of-work",
    "observer",
    "strategy",
  ],
  participants: [
    {
      id: "command",
      label: "Command",
      role: "Command interface",
      kind: "interface",
      x: 400,
      y: 60,
      description:
        "Declares execute() and undo(). The invoker only ever programs against this interface.",
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 130,
      y: 60,
      description:
        "Creates the concrete commands, binding each one to the receiver it should act on, and hands them to the invoker.",
      code: "createCommands",
    },
    {
      id: "remote",
      label: "RemoteButton",
      role: "Invoker",
      kind: "class",
      x: 400,
      y: 230,
      width: 170,
      description:
        "Holds the current command and a history stack. press() calls execute() and records it; undoLast() pops the stack and calls undo().",
    },
    {
      id: "onCommand",
      label: "LightOnCommand",
      role: "Concrete Command",
      kind: "class",
      x: 660,
      y: 140,
      description:
        "Binds to a specific Light. execute() turns it on; undo() reverses that by turning it back off.",
    },
    {
      id: "offCommand",
      label: "LightOffCommand",
      role: "Concrete Command",
      kind: "class",
      x: 660,
      y: 320,
      description:
        "Binds to a specific Light. execute() turns it off; undo() reverses that by turning it back on.",
    },
    {
      id: "light",
      label: "Light",
      role: "Receiver",
      kind: "class",
      x: 400,
      y: 380,
      width: 150,
      description:
        "Knows how to actually turn itself on and off. It has no idea that a Command or a RemoteButton exists.",
    },
  ],
  relations: [
    {
      id: "holds",
      from: "remote",
      to: "command",
      type: "holds",
      label: "history[]",
      description:
        'The invoker stores commands typed only as Command — both in its "current" slot and its history stack.',
      code: "remote",
    },
    {
      id: "on-impl",
      from: "onCommand",
      to: "command",
      type: "implements",
      description: "LightOnCommand implements Command.",
    },
    {
      id: "off-impl",
      from: "offCommand",
      to: "command",
      type: "implements",
      description: "LightOffCommand implements Command.",
      bend: 30,
    },
    {
      id: "create-on",
      from: "client",
      to: "onCommand",
      type: "creates",
      label: "new LightOnCommand(light)",
      description:
        "The client creates a LightOnCommand bound to a specific Light instance.",
      code: "createCommands",
    },
    {
      id: "create-off",
      from: "client",
      to: "offCommand",
      type: "creates",
      label: "new LightOffCommand(light)",
      description:
        "The client creates a LightOffCommand bound to the same Light instance.",
      bend: -20,
      code: "createCommands",
    },
    {
      id: "bind",
      from: "client",
      to: "remote",
      type: "calls",
      label: "setCommand()",
      description:
        "The client hands a command to the remote, which stores it as the current command to run on the next press.",
      code: "setCommand",
    },
    {
      id: "press-on",
      from: "remote",
      to: "onCommand",
      type: "calls",
      label: "execute()",
      description:
        "Pressing the button calls execute() on whichever command is currently loaded.",
      code: "execute",
    },
    {
      id: "press-off",
      from: "remote",
      to: "offCommand",
      type: "calls",
      label: "execute()",
      description:
        "Pressing the button calls execute() on whichever command is currently loaded.",
      code: "execute",
    },
    {
      id: "on-effect",
      from: "onCommand",
      to: "light",
      type: "calls",
      label: "turnOn()",
      description:
        "LightOnCommand’s execute() records whether the light was already on, then calls turnOn(); its undo() calls turnOff() only if the light was off beforehand.",
    },
    {
      id: "off-effect",
      from: "offCommand",
      to: "light",
      type: "calls",
      label: "turnOff()",
      description:
        "LightOffCommand’s execute() records whether the light was already on, then calls turnOff(); its undo() calls turnOn() only if the light was on beforehand.",
    },
  ],
  steps: [
    {
      title: "Client wires up commands",
      description:
        "The client creates one command per action, each bound to the same Light. Neither command nor light knows about the remote yet.",
      highlight: ["client", "create-on", "create-off", "light"],
      notes: { onCommand: "bound", offCommand: "bound" },
      code: "createCommands",
    },
    {
      title: "Remote stores the command",
      description:
        'The client loads LightOnCommand into the remote. The remote only knows it holds "a Command" — not which one.',
      highlight: ["bind", "remote"],
      notes: { remote: "current: On" },
      code: "setCommand",
    },
    {
      title: "Button press executes it",
      description:
        "Pressing the button calls execute() on the current command, which calls turnOn() on the light it was bound to.",
      highlight: ["remote", "press-on", "on-effect", "light"],
      packets: [
        { relation: "press-on", label: "execute()" },
        { relation: "on-effect", label: "turnOn()", after: 0 },
      ],
      notes: { light: "on", remote: "history: 1" },
      code: "execute",
    },
    {
      title: "Swap command and press again",
      description:
        "The client loads LightOffCommand instead and presses again. The remote’s press() logic never changes.",
      highlight: ["bind", "remote", "press-off", "off-effect", "light"],
      packets: [
        { relation: "press-off", label: "execute()" },
        { relation: "off-effect", label: "turnOff()", after: 0 },
      ],
      notes: { light: "off", remote: "history: 2" },
      code: "execute",
    },
    {
      title: "Undo reverses the last command",
      description:
        'undoLast() pops LightOffCommand from the history and calls undo(). It had recorded the light as "on" right before it executed, so undo() calls turnOn() to restore exactly that state.',
      highlight: ["remote", "press-off", "off-effect", "light"],
      packets: [
        { relation: "press-off", label: "undo()" },
        { relation: "off-effect", label: "turnOn()", after: 0 },
      ],
      notes: { remote: "history: 1", light: "on" },
      code: "undo",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
};
