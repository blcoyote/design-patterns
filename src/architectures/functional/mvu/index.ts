import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { MvuVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "mvu",
  name: "Model-View-Update (Elm Architecture)",
  paradigm: "functional",
  order: 12,
  summary: "Keep app state immutable, update it with messages, and render the current state.",
  intent:
    "Represent an app with an immutable Model, a pure `update` function that maps each message to a new Model and any commands, and a pure `view` function. A small runtime dispatches messages, renders the new Model, and performs the returned commands.",
  problem:
    "When a todo app changes state in several methods, one action can quietly trigger another: adding an item may save it and update a flag. A handler can also change the list without updating the rest of the state. To explain what the UI shows, you have to trace every method that may have changed it. Undo then means writing the reverse of each change by hand.",
  solution:
    "Represent every change as a message, such as `{ type: 'add', text }`. A pure `update(model, msg)` function returns a new Model and any command to run; it does not perform side effects itself. The runtime runs those commands and can send their results back as new messages. A pure `view(model)` renders the current Model. Because Models are immutable, the runtime can keep earlier versions for time-travel debugging without defensive copies. The trade-off is memory: history keeps every Model it has seen.",
  analogy:
    "A flipbook drawn by a strict animator. Each instruction slip (a Msg) goes to the animator (update), who never touches a page already drawn — they draw the next page from the current page plus the slip, and add it to the back of the book (history). What is projected on screen (the view) is just the current page, so flipping back to page 1 shows exactly what was there without redrawing anything — at the price of keeping every page in the book.",
  whenToUse: [
    "UI or application state has gotten hard to reason about because several code paths mutate it directly, in an order that matters.",
    'You want "what changed, and why" to be answerable from the messages that were dispatched, not by reconstructing mutation order from a stack trace.',
    "Undo, redo, or time-travel debugging would be valuable, and you want it to fall out of immutability rather than being hand-built as a feature.",
    "The team already favors pure functions and plain data (TypeScript/Redux-style reducers, Elm, F#, functional React) over stateful classes.",
  ],
  pros: [
    'update and view are pure, so testing a transition is "call update with a literal Model and Msg, assert on the Model and cmds it returns" — no mocks, no partially-initialized objects.',
    "Immutability makes it safe to keep every Model the app has ever been in without defensive copies, which turns time-travel debugging into a few lines of runtime code.",
    "Every change arrives as a plain Msg through one dispatch(), so logging them there gives a complete, inspectable record of what happened — exactly the data a bug report, a replay tool, or an audit trail needs.",
    "The one-way loop (dispatch → update → render) rules out an entire class of bugs where two different code paths mutate the same state in a different order depending on timing.",
  ],
  cons: [
    "Every state change has to be expressed as a message and a switch/match arm, which is more ceremony than calling a setter for genuinely simple, local UI state.",
    "Commands push side effects to the edge of the program, which means the runtime has to grow a case for every new effect type the update function learns to return.",
    "Large Models and Msg unions that aren't split into smaller sub-loops become one sprawling update function that is hard to navigate.",
    "History trades memory for time travel: it keeps every Model alive, and each new Model copies whatever collections changed, so a long session grows memory with every dispatch unless history is capped.",
    "Time-travel and history only cover what the Model captures — effects that already fired for real (an email that was sent) can't be undone by stepping the Model backward.",
  ],
  realWorld: [
    "In Elm this architecture is the standard shape of every interactive program: `Browser.element` takes `init`, `update`, `view` and `subscriptions`, and the Elm guide describes the pattern as having emerged naturally from early Elm code",
    "Redux (explicitly inspired by Elm) and React's useReducer use the same reducer loop: a pure reducer and dispatched actions. Unlike update, a reducer returns no Cmds; effects live outside it, in middleware or useEffect",
    "Redux DevTools' time-travel slider builds on the same idea: it records every dispatched action and caches each computed state, so jumping back is a lookup",
    "The Elm Architecture has been ported deliberately into other ecosystems: Elmish (F#/Fable), Fabulous (F# for .NET MAUI and Avalonia), and The Composable Architecture (TCA) for SwiftUI",
  ],
  concepts: [
    {
      term: "Model",
      description:
        "The entire application state as one immutable value. There is exactly one Model, and the only way to get a new one is through update.",
    },
    {
      term: "Msg",
      description:
        "A message is data describing something that happened — a discriminated union of every kind of change the app understands, not a method call.",
    },
    {
      term: "update",
      description:
        "The pure core: (model, msg) -> (model, cmds). Given the same Model and Msg, it always returns the same next Model and the same commands — an explicit, total state machine.",
    },
    {
      term: "view",
      description:
        "A pure function from Model to rendered output. It never mutates anything and never reads anything but the Model it is given.",
    },
    {
      term: "Cmd (command)",
      description:
        "A plain description of a side effect to perform — 'save this todo' — returned by update instead of performed by it. The runtime is the only thing that actually carries it out.",
    },
    {
      term: "Runtime loop",
      description:
        "The thin, impure shell: it dispatches a message, calls update, stores and renders the new Model, notifies subscribers, and then performs whatever Cmds came back — which may dispatch further messages and run the loop again.",
    },
    {
      term: "History / time-travel",
      description:
        "Because every Model is immutable, the runtime can keep every one it has ever produced in a list and jump back to any of them without recomputing anything — a snapshot lookup, not a replay of messages.",
    },
    {
      term: "Subscriber (render listener)",
      description:
        "A listener registered with this example's runtime that is notified with the freshly rendered output after every dispatch — the piece that actually puts it on screen. Not to be confused with Elm's `Sub` / `subscriptions`, which turn outside events (timers, sockets, keyboard) into Msgs fed into update.",
    },
  ],

  variants: [
    {
      name: "Redux / useReducer (React)",
      description:
        "JavaScript's take on the same loop: a pure reducer `(state, action) => state` in place of update, dispatched actions in place of Msg, middleware in place of the Cmd runtime.",
    },
    {
      name: "Elmish / Fabulous",
      description:
        "Direct ports of the Elm Architecture into F#: the same Model/Msg/update/view shape, with Cmd<Msg> values for effects. Elmish targets the browser via Fable; Fabulous applies it to desktop and mobile UI (.NET MAUI, Avalonia).",
    },
    {
      name: "SwiftUI — The Composable Architecture (TCA)",
      description:
        "A popular third-party library that brings the same reducer-plus-effects shape to SwiftUI, adding composition and testing tools on top of the core MVU loop.",
    },
    {
      name: "Flux",
      description:
        "Facebook's architecture that Redux evolved from: unidirectional data flow through a dispatcher and stores, though without insisting the store-update step be a single pure function.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "command",
        why: 'A Msg like `{ type: "add", text }` is data describing intent, not a method call; the Cmd values update() returns (`{ type: "save", id }`) are Command objects the runtime executes later — Command applied to both the request and the effect.',
      },
      {
        slug: "state",
        why: "update(model, msg) is an explicit, total state machine: every reachable Model plus every Msg maps to exactly one transition. It is a functional take on State, not the GoF class-per-state hierarchy — there is one function, not one class per state.",
      },
      {
        slug: "interpreter",
        why: "Runtime.perform() walks the Cmd values update() returned and performs the matching effect, one case per Cmd type — the same tree-walking role Interpreter plays over a small grammar, here a grammar of effect descriptions.",
      },
      {
        slug: "memento",
        why: "Runtime keeps every Model it has produced in a history list; calling timeTravel(index) resumes an earlier one without recomputing it. Because Model is immutable, no deep copy is needed to protect a snapshot from later mutation — though keeping all of them still costs memory.",
      },
      {
        slug: "observer",
        why: "Runtime.notify() calls every subscriber with the freshly rendered view after each dispatch; subscribe() is how a listener registers for those notifications — Observer's subject/observer roles, played by the runtime and its subscribers.",
      },
    ],
    architectures: [
      {
        slug: "mvc",
        why: "MVU is often presented as MVC's functional successor: it replaces the controller, a mutable Model, and an ad hoc observer wiring with one pure update function and a single, explicit message flow through dispatch().",
      },
      {
        slug: "functional-core",
        why: "update and view are exactly a functional core — pure, effect-free, total functions over plain data — with the Runtime loop playing the imperative shell that performs the Cmds they describe.",
      },
      {
        slug: "event-sourcing",
        why: "Both keep history, of different things: Runtime's history stores already-folded Models, so timeTravel is a lookup, while Event Sourcing stores events and rebuilds state by replaying them through evolve. Logging MVU's Msgs instead, and replaying them through update, would turn its history into an event log.",
      },
    ],
  },

  viewBox: "0 0 800 460",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client · UI trigger",
      kind: "client",
      x: 90,
      y: 70,
      description:
        "A button click or keystroke that wants something to happen. It never touches the Model directly — it only ever builds a Msg.",
    },
    {
      id: "msg",
      label: "Msg",
      role: "Message · intent as data",
      kind: "object",
      x: 90,
      y: 230,
      description:
        'A plain value describing what happened — e.g. `{ type: "add", text: "Buy milk" }`. Dispatching it is the only way anything changes.',
      patterns: ["command"],
    },
    {
      id: "runtime",
      label: "Runtime",
      role: "Imperative shell · loop",
      kind: "class",
      x: 330,
      y: 150,
      width: 190,
      description:
        "The only impure piece: dispatches messages, calls update, stores every resulting Model in history, performs Cmds, and notifies subscribers.",
    },
    {
      id: "update",
      label: "update()",
      role: "Pure core · reducer",
      kind: "object",
      x: 570,
      y: 70,
      width: 150,
      description:
        "(Model, Msg) -> (Model, Cmd[]). An explicit, total state machine with no I/O of its own.",
      patterns: ["state"],
    },
    {
      id: "history",
      label: "History",
      role: "Model snapshot log",
      kind: "object",
      x: 570,
      y: 230,
      width: 160,
      description:
        "Every Model the runtime has produced, in order. Immutability means no entry needs a defensive copy — nothing can mutate an old one out from under it — but every entry stays in memory.",
      patterns: ["memento"],
    },
    {
      id: "effects",
      label: "Cmd runtime",
      role: "Imperative shell · interpreter",
      kind: "interface",
      x: 330,
      y: 330,
      width: 180,
      description:
        "The part of Runtime that walks the Cmd values update() returned and performs the matching effect — here, a simulated 'save'.",
      patterns: ["interpreter"],
    },
    {
      id: "view",
      label: "view()",
      role: "Pure render function",
      kind: "object",
      x: 570,
      y: 390,
      description:
        "Model -> rendered text. Reads only its argument, builds only a string, performs no I/O.",
    },
    {
      id: "subs",
      label: "Subscribers",
      role: "Observer · UI listeners",
      kind: "client",
      x: 90,
      y: 390,
      description:
        "Whatever is watching the runtime — here, a console logger — notified with the freshly rendered view after every dispatch.",
      patterns: ["observer"],
    },
  ],
  relations: [
    {
      id: "create",
      from: "client",
      to: "msg",
      type: "creates",
      label: "new Msg",
      description:
        "The client does not call a method on the Model; it builds a plain Msg value describing what happened.",
      code: "msg",
    },
    {
      id: "dispatch",
      from: "msg",
      to: "runtime",
      type: "calls",
      label: "dispatch(msg)",
      description:
        "The Msg is handed to Runtime.dispatch(), the single entry point into the whole loop.",
      code: "runtime",
    },
    {
      id: "callUpdate",
      from: "runtime",
      to: "update",
      type: "calls",
      label: "update(model, msg)",
      description:
        "The runtime calls the pure update function with the current Model and the Msg — nothing else crosses this boundary.",
      bend: -30,
      code: "update",
    },
    {
      id: "pushHistory",
      from: "runtime",
      to: "history",
      type: "creates",
      label: "push(next)",
      description:
        "The Model update() returned is appended to the history log, which is what makes time-travel possible later.",
      code: "runtime",
    },
    {
      id: "runCmd",
      from: "runtime",
      to: "effects",
      type: "calls",
      label: "perform(cmd)",
      description:
        "Each Cmd that update() returned is handed to the command interpreter, which performs the matching effect for real.",
      code: "runtime",
    },
    {
      id: "loopBack",
      from: "effects",
      to: "runtime",
      type: "calls",
      label: "dispatch(saved)",
      description:
        "Performing the simulated 'save' effect produces a result, which is fed back in as a new Msg — closing the loop by dispatching again.",
      bend: 40,
      code: "runtime",
    },
    {
      id: "render",
      from: "runtime",
      to: "view",
      type: "calls",
      label: "view(model)",
      description:
        "Right after each new Model is stored, the runtime calls the pure view function to render it to text.",
      code: "view",
    },
    {
      id: "notify",
      from: "runtime",
      to: "subs",
      type: "notifies",
      label: "notify(rendered)",
      description:
        "The rendered text is pushed to every subscriber — the Observer role in this loop.",
      code: "runtime",
    },
    {
      id: "travel",
      from: "client",
      to: "history",
      type: "calls",
      label: "timeTravel(index)",
      description:
        "Stepping back asks the history log for an earlier Model and makes it current again, without re-running update.",
      bend: -40,
      code: "runtime",
    },
  ],

  steps: [
    {
      title: "One loop: Model, Msg, update, view",
      description:
        "A Msg is dispatched into Runtime, which calls the pure update() to get the next Model and any Cmds, stores that Model in History, renders it with the pure view() and notifies Subscribers — and only then performs the Cmds, each of which may dispatch another Msg and run the loop again.",
      highlight: ["client", "msg", "runtime", "update", "history", "effects", "view", "subs"],
    },
    {
      title: "A message is dispatched",
      description:
        'The client builds a plain Msg — `{ type: "add", text: "Buy milk" }` — and hands it to runtime.dispatch(). That call is the only way anything in the app is allowed to change.',
      highlight: ["client", "create", "msg", "dispatch", "runtime"],
      packets: [
        { relation: "create", label: "new Msg" },
        { relation: "dispatch", label: "dispatch(msg)", after: 0 },
      ],
      notes: { msg: '{ type: "add", text: "Buy milk" }' },
      code: "msg",
    },
    {
      title: "update() computes the next model and a command",
      description:
        "Runtime calls update(model, msg) with nothing but plain values. It returns a new Model with the todo appended, plus a Cmd describing a save that still needs to happen — update() does not perform it.",
      highlight: ["runtime", "callUpdate", "update"],
      packets: [{ relation: "callUpdate", label: "update(model, msg)" }],
      notes: { update: "returns (model, [save id:1])" },
      code: "update",
    },
    {
      title: "The new model joins the history log",
      description:
        "The Model update() returned is appended to History. Because Models are immutable, appending just keeps a reference — no defensive copy — and that list is the entire mechanism behind time-travel.",
      highlight: ["runtime", "pushHistory", "history"],
      packets: [{ relation: "pushHistory", label: "push(next)" }],
      notes: { history: "history: 2 models" },
      code: "runtime",
    },
    {
      title: "The view renders and subscribers are notified",
      description:
        'Before any Cmd runs, Runtime calls the pure view() on the new Model and pushes the rendered text to every subscriber. The save has not happened yet, so this first render still says "saved: none yet".',
      highlight: ["runtime", "render", "view", "notify", "subs"],
      packets: [
        { relation: "render", label: "view(model)" },
        { relation: "notify", label: "notify(rendered)", after: 0 },
      ],
      notes: { subs: '"[ ] Buy milk\\n(saved: none yet)"' },
      code: "view",
    },
    {
      title: "The runtime performs the command, and the loop runs again",
      description:
        "Only now does the runtime perform the returned Cmd. The Cmd runtime simulates the 'save' and dispatches the result straight back in as a Saved message, which runs the whole loop again: update() sets lastSaved, a third Model joins History, and the view renders a second time with `saved #1`.",
      highlight: [
        "runtime",
        "runCmd",
        "effects",
        "loopBack",
        "callUpdate",
        "update",
        "pushHistory",
        "history",
        "render",
        "view",
        "notify",
        "subs",
      ],
      packets: [
        { relation: "runCmd", label: "perform(save id:1)" },
        { relation: "loopBack", label: "dispatch(saved id:1)", after: 0 },
        { relation: "callUpdate", label: "update(model, saved)", after: 1 },
        { relation: "pushHistory", label: "push(next)", after: 2 },
        { relation: "render", label: "view(model)", after: 3 },
        { relation: "notify", label: "notify(rendered)", after: 4 },
      ],
      notes: {
        history: "history: 3 models",
        subs: '"[ ] Buy milk\\n(saved #1)"',
      },
      code: "runtime",
    },
    {
      title: "Time travel: step back to an earlier model",
      description:
        "After a later toggle brings History to 4 entries, timeTravel(0) moves the cursor back to the very first Model and re-renders it — no replay, no recomputation, just picking a different entry from the log.",
      highlight: ["client", "travel", "history", "runtime"],
      packets: [{ relation: "travel", label: "timeTravel(0)" }],
      notes: {
        history: "history: 4 models, cursor → 0",
        subs: '"(saved: none yet)"',
      },
      code: "runtime",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: MvuVisualization,
};
