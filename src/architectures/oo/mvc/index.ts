import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { MvcVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "mvc",
  name: "Model-View-Controller",
  paradigm: "oo",
  order: 7,
  summary:
    "Split an app into state (Model), presentation (View) and input handling (Controller), with the View watching the Model for changes.",
  intent:
    "Separate what an application knows (the Model) from how it is shown (the View) and how input is interpreted (the Controller), so any of the three can change — a second display, a different input device, a new business rule — without the other two caring.",
  problem:
    "A screen that owns its state, draws itself, and handles mouse and keyboard input puts three jobs in one class. Adding a second view of the same data then means duplicating state logic or reaching into the first screen. There is no clear place to track what happened or what the app should show next.",
  solution:
    "The Model owns the state and business rules. Views read it and update when it changes, using the Observer pattern so they do not have to keep checking. A Controller interprets user input and calls the Model. The View talks to the Controller through an interface, so you can change how input is handled without changing the View.",
  analogy:
    "A restaurant kitchen (Model) holds the actual state of an order — what has been cooked, what is still waiting. The dining room display and the kitchen printer (two Views) both show that state, but neither one decides what gets cooked. A waiter (Controller) takes the customer's spoken request, translates it into an order placed with the kitchen, and the kitchen is the only thing that ever updates the order itself.",
  whenToUse: [
    "The same underlying state needs to be shown more than one way at once — a list and a summary count, a chart and a table.",
    "Input handling is complex or varies by context (mouse vs. keyboard, a different device) and you want to swap it without touching rendering code.",
    "You want to unit-test business rules without instantiating any UI at all.",
    "A UI framework already gives you View and Controller plumbing (most do) and you mainly need to decide where the Model boundary sits.",
  ],
  pros: [
    "Multiple Views can observe one Model without that Model knowing how many there are, or anything about them.",
    "The Model is plain, UI-free code, so business rules are testable without a renderer, a DOM, or a device.",
    "Input handling lives in Controllers, so a new input source (keyboard shortcuts, a CLI, a script) is a new Controller, not a rewrite of the View.",
    "The three roles can be worked on, and reasoned about, separately once the boundaries are drawn.",
  ],
  cons: [
    "For a trivial screen with one piece of state and one way to show it, the three-way split is pure ceremony.",
    "Nothing stops a View from reaching into the Model and mutating it directly, bypassing the Controller — the separation is a convention, not an enforced boundary.",
    "Naive Observer notification re-renders every View on every change; a large Model with many small updates needs more fine-grained change events to stay efficient.",
    'The term "MVC" is overloaded — web "MVC" frameworks (Controller returns a page, no live Observer link) look little like the desktop pattern GoF describes, which this example follows.',
  ],
  realWorld: [
    "Smalltalk-80's class library, the first widely used MVC implementation (the name comes from Trygve Reenskaug's 1979 notes at Xerox PARC): Controllers and Views were separate objects and the Model used a true Observer (dependents) mechanism.",
    "Desktop UI toolkits such as Java Swing, whose models notify registered listeners, keeping a live Observer link between Model and View, closer to the original pattern. (Cocoa/AppKit instead routes Model → View updates through a mediating controller.)",
    'Web "MVC" frameworks (Rails, ASP.NET MVC; Django calls its version "MTV"), which reuse the idea for a request/response cycle: Controller builds a page from the Model once per request, with no ongoing Observer notification.',
    "Any UI widget library where a data-bound list widget (the View) redraws itself whenever the underlying collection it is bound to (the Model) changes.",
  ],
  concepts: [
    {
      term: "Model",
      description:
        "Owns state and the rules for changing it. Knows nothing about any View or Controller — in this example, TodoModel never imports either.",
    },
    {
      term: "View",
      description:
        "Renders the Model's current state and forwards raw input to its Controller. TodoListView and RemainingCountView are both Views over the same TodoModel.",
    },
    {
      term: "Controller",
      description:
        "Interprets input and decides which operation to invoke on the Model. A View holds its Controller through a Strategy interface (TypeScript/C#/Go interface, Python Protocol), so a different implementation changes behaviour without the View changing.",
    },
    {
      term: "Observer notification",
      description:
        'The mechanism — plain subscribe/notify here — by which the Model tells every registered View to refresh. GoF describes this as the Model\'s "dependents" in the original Smalltalk form.',
    },
    {
      term: "Passive vs. active Model",
      description:
        'With a "passive Model", only the Controller changes the Model, so the Controller then tells the View to refresh. With an "active Model" (used here), the Model notifies its registered Views itself whenever it changes. Both are classic Smalltalk MVC.',
    },
  ],
  variants: [
    {
      name: "MVP (Model-View-Presenter)",
      description:
        "The Presenter takes over input handling and presentation logic. In its Passive View flavour, the Presenter also pushes fully-formed data into a View that exposes only simple setters and never reads the Model itself; in the Supervising Controller flavour, the View still binds to the Model for simple data.",
    },
    {
      name: "MVVM (Model-View-ViewModel)",
      description:
        'A ViewModel exposes Model state as observable properties; the View binds to them declaratively, so the explicit "notify every View" loop this example writes by hand is replaced by a data-binding framework.',
    },
    {
      name: 'Smalltalk-80 MVC vs. web "MVC"',
      description:
        'The original form keeps a live Model-to-View Observer link, as in this example; most "MVC" web frameworks instead rebuild the page once per request and drop the live link entirely.',
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "observer",
        why: "TodoModel.notify() iterates a snapshot of its registered TodoView observers and calls update(model) on each — the textbook Observer notification loop.",
      },
      {
        slug: "strategy",
        why: "TodoListView holds its Controller through an interface (TodoInputController / ITodoInputController / the TodoInputController Protocol) and forwards every click to it (clickAdd, clickToggle); the concrete TodoController is an interchangeable strategy for responding to input, exactly as GoF's own discussion of MVC describes it.",
      },
      {
        slug: "composite",
        why: "TodoListView and TodoItemView both implement the Renderable interface, and TodoListView.render() joins its children's render() through that shared interface without caring which concrete view each child is — the list view is a Composite of item views, as GoF notes MVC views commonly are.",
      },
      {
        slug: "command",
        why: "A click is reified as an AddTodoCommand or ToggleTodoCommand object before the Controller runs it, instead of the Controller calling the Model inline.",
      },
    ],
    architectures: [
      {
        slug: "layered",
        why: "MVC is typically the internal shape of a layered app's presentation layer, with the Model boundary lining up with the layer below it.",
      },
      {
        slug: "mvu",
        why: "Model-View-Update is the functional cousin: one pure update function replaces this example's Controller-plus-Command-plus-mutable-Model-plus-Observer wiring entirely.",
      },
    ],
  },

  // Diagram (viewBox 800 × 460, x/y are box centres)
  viewBox: "0 0 800 460",
  participants: [
    {
      id: "user",
      label: "User",
      role: "Client",
      kind: "client",
      x: 90,
      y: 50,
      description:
        "Clicks a button in the running app. In this example, as in GoF's Strategy reading of MVC, the raw input arrives at the View; in Smalltalk-80 the Controller read the mouse and keyboard directly.",
    },
    {
      id: "controller",
      label: "TodoController",
      role: "Controller",
      kind: "class",
      x: 130,
      y: 190,
      width: 170,
      description:
        "Interprets a click and decides which Command to run against the Model. Plugged into the View through a Strategy interface, so a different implementation changes behaviour without the View changing.",
      patterns: ["strategy"],
    },
    {
      id: "command",
      label: "Add/ToggleTodoCommand",
      role: "Command",
      kind: "object",
      x: 130,
      y: 330,
      width: 190,
      description:
        "A reified user action. The Controller builds one of these per click and executes it, instead of calling the Model inline.",
      patterns: ["command"],
    },
    {
      id: "model",
      label: "TodoModel",
      role: "Model",
      kind: "class",
      x: 400,
      y: 230,
      width: 170,
      description:
        "Owns the list of todos and the rules for changing it. Knows nothing about TodoController, TodoListView or RemainingCountView — only that some number of TodoView observers are subscribed.",
      patterns: ["observer"],
    },
    {
      id: "listView",
      label: "TodoListView",
      role: "View",
      kind: "class",
      x: 660,
      y: 90,
      width: 180,
      description:
        "Renders the full list by rebuilding one TodoItemView per todo and joining their render() output through the shared Renderable interface. Re-renders itself whenever TodoModel notifies it.",
      patterns: ["observer", "composite"],
    },
    {
      id: "itemView",
      label: "TodoItemView",
      role: "View (Composite leaf)",
      kind: "object",
      x: 660,
      y: 200,
      width: 170,
      description:
        "Renders a single todo row through the Renderable interface. TodoListView rebuilds one of these per todo every time it redraws.",
    },
    {
      id: "countView",
      label: "RemainingCountView",
      role: "View",
      kind: "class",
      x: 660,
      y: 330,
      width: 190,
      description:
        'A second View watching the same Model, showing only "N remaining". Proof that a Model can have more than one View without knowing it.',
      patterns: ["observer"],
    },
  ],
  relations: [
    {
      id: "input",
      from: "user",
      to: "listView",
      type: "calls",
      label: "click",
      description:
        "In this example, raw input arrives at the View first (in Smalltalk-80 the Controller read input devices directly). The View does not decide what it means — it only forwards it.",
      code: "usage",
    },
    {
      id: "delegate",
      from: "listView",
      to: "controller",
      type: "calls",
      label: "handleAddClick(text)",
      description:
        "The View forwards the click to its Controller. Because the Controller is held through a Strategy interface, swapping the implementation changes how this click is handled without touching TodoListView.",
      code: "listView",
    },
    {
      id: "dispatch",
      from: "controller",
      to: "command",
      type: "creates",
      label: "new AddTodoCommand(text)",
      description:
        "The Controller reifies the click as a Command object instead of calling the Model directly.",
      code: "controller",
    },
    {
      id: "execute",
      from: "command",
      to: "model",
      type: "calls",
      label: "execute(model)",
      description: "The Command runs the actual change on the Model — here, addTodo(text).",
      code: "command",
    },
    {
      id: "notifyList",
      from: "model",
      to: "listView",
      type: "notifies",
      label: "update(model)",
      description:
        "Once its state has changed, the Model notifies every registered View. It iterates a snapshot of its observers, not the live list.",
      bend: -16,
      code: "model",
    },
    {
      id: "notifyCount",
      from: "model",
      to: "countView",
      type: "notifies",
      label: "update(model)",
      description:
        "The same notification also reaches RemainingCountView — a second View, watching the same Model, that TodoModel knows nothing specific about.",
      bend: 16,
      code: "model",
    },
    {
      id: "compose",
      from: "listView",
      to: "itemView",
      type: "creates",
      label: "renders TodoItemView",
      description:
        "TodoListView rebuilds one TodoItemView per todo and joins their render() output through the shared Renderable interface — the list view is a Composite of item views.",
      code: "listView",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Model, two Views, one Controller",
      description:
        "TodoModel owns the state. Two Views — TodoListView and RemainingCountView — are both subscribed to it as Observers. TodoController sits between raw input and the Model, plugged into the View through a Strategy interface.",
      highlight: ["user", "controller", "command", "model", "listView", "itemView", "countView"],
    },
    {
      title: "A click arrives at the View",
      description:
        'The user clicks "Add" with the text "Buy milk". TodoListView receives the raw input first — it has not yet decided what to do with it.',
      highlight: ["user", "input", "listView"],
      packets: [{ relation: "input", label: 'click Add "Buy milk"' }],
      notes: { listView: "received click" },
      code: "usage",
    },
    {
      title: "The View delegates to its Controller (Strategy)",
      description:
        "TodoListView does not interpret the click itself — it forwards it to whichever controller it holds, typed only as the TodoInputController interface. A different implementation plugged in here would handle the same click differently.",
      highlight: ["listView", "delegate", "controller"],
      packets: [{ relation: "delegate", label: 'handleAddClick("Buy milk")' }],
      notes: { controller: "interpreting input" },
      code: "listView",
    },
    {
      title: "The Controller reifies the click as a Command",
      description:
        "TodoController builds an AddTodoCommand carrying the text, instead of calling TodoModel directly.",
      highlight: ["controller", "dispatch", "command"],
      packets: [{ relation: "dispatch", label: 'new AddTodoCommand("Buy milk")' }],
      notes: { command: 'AddTodoCommand("Buy milk")' },
      code: "controller",
    },
    {
      title: "The Command executes the change on the Model",
      description:
        'AddTodoCommand.execute() calls model.addTodo("Buy milk"). TodoModel assigns id 1 from its own counter and adds the todo.',
      highlight: ["command", "execute", "model"],
      packets: [{ relation: "execute", label: "execute(model)" }],
      notes: { model: "1 todo, id 1" },
      code: "command",
    },
    {
      title: "The Model notifies every registered View",
      description:
        "TodoModel.notify() walks a snapshot of its observers and calls update(model) on each: first TodoListView, then RemainingCountView, in subscription order.",
      highlight: ["model", "notifyList", "notifyCount", "listView", "countView"],
      packets: [
        { relation: "notifyList", label: "update(model)" },
        { relation: "notifyCount", label: "update(model)", after: 0 },
      ],
      notes: { model: "notifying 2 observers" },
      code: "model",
    },
    {
      title: "Both Views re-render independently",
      description:
        'TodoListView rebuilds one TodoItemView per todo and prints "[ ] Buy milk" by joining their render() output through the shared Renderable interface. RemainingCountView, watching the same Model, prints "1 remaining" — neither View knows the other exists.',
      highlight: ["listView", "compose", "itemView", "countView"],
      packets: [{ relation: "compose", label: "renders TodoItemView" }],
      notes: { listView: "[ ] Buy milk", countView: "1 remaining" },
      code: "listView",
    },
    {
      title: "The same path drives a toggle",
      description:
        'Clicking the checkbox on item 1 runs the identical path — View to Controller to a ToggleTodoCommand to the Model — ending with TodoListView printing "[x] Buy milk" and RemainingCountView dropping to "0 remaining".',
      highlight: [
        "user",
        "input",
        "listView",
        "delegate",
        "controller",
        "dispatch",
        "command",
        "execute",
        "model",
        "notifyList",
        "notifyCount",
        "countView",
      ],
      packets: [
        { relation: "input", label: "click checkbox #1" },
        { relation: "delegate", label: "handleToggleClick(1)", after: 0 },
        { relation: "dispatch", label: "new ToggleTodoCommand(1)", after: 1 },
        { relation: "execute", label: "execute(model)", after: 2 },
        { relation: "notifyList", label: "update(model)", after: 3 },
        { relation: "notifyCount", label: "update(model)", after: 4 },
      ],
      notes: {
        model: "todo 1 toggled",
        listView: "[x] Buy milk",
        countView: "0 remaining",
      },
      code: "usage",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: MvcVisualization,
};
