import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "mediator",
  name: "Mediator",
  category: "behavioral",
  order: 8,
  summary:
    "Centralize how a set of objects communicate so they never reference each other directly.",
  intent:
    "Put one object in the middle to coordinate a group of colleagues, so they talk to the mediator instead of to each other.",
  problem:
    'A login dialog has a username field, a password field, a "remember me" checkbox and a submit button, and the widgets need to react to each other. Typing a username should enable the submit button, and checking remember-me should move focus to the password field. If you wire every widget directly to every other widget, you get a tangle of references. Nothing can change without touching several classes, and no widget can be reused in a different dialog.',
  solution:
    "Give every widget a reference to a single Mediator instead of to each other. A widget only tells the mediator when something happens to it, by calling notify(sender, event). The mediator holds all the cross-widget logic and decides which other widgets to update and how. The widgets stay simple and reusable, and the dialog-specific behavior lives in exactly one place.",
  analogy:
    "Think of an air traffic control tower. Pilots don't coordinate directly with each other in the air. Each plane radios the tower, and the tower, which alone sees the whole picture, decides who climbs, holds, or lands.",
  whenToUse: [
    "A group of objects talk to each other in complex, unstructured ways, and the web of dependencies is hard to follow.",
    "An object is hard to reuse because it refers to, and talks to, many other objects.",
    "You want to adjust behavior spread across several classes without lots of subclassing.",
  ],
  pros: [
    "Removes direct references between the colleagues: each one only knows the mediator.",
    "Puts the control logic in one place instead of scattering it across every participant.",
    "Colleagues are easier to reuse on their own or to plug into a different mediator.",
  ],
  cons: [
    'The mediator itself can grow into a "god object" that is hard to maintain.',
    "One central point of coordination can become a bottleneck or a single point of failure.",
    "The interaction logic is easy to find but less explicit than following direct calls between objects.",
  ],
  realWorld: [
    "UI dialogs and forms that coordinate field validation and enabling/disabling buttons (the classic GoF example)",
    "Chat room servers: clients only talk to the room, never directly to each other",
    'Frontend "controller" components that orchestrate several otherwise simple child components',
  ],
  related: ["observer", "facade", "command", "chain-of-responsibility"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "mediatorIface",
      label: "Mediator",
      role: "Mediator interface",
      kind: "interface",
      x: 400,
      y: 65,
      description:
        "Declares notify(sender, event) — the one method every colleague uses to report something about itself. Colleagues depend only on this.",
    },
    {
      id: "dialog",
      label: "LoginDialog",
      role: "Concrete Mediator",
      kind: "class",
      x: 400,
      y: 230,
      width: 180,
      description:
        "Implements Mediator and owns the four widgets directly. All the dialog-specific logic (enable this, focus that) lives here and nowhere else.",
    },
    {
      id: "username",
      label: "UsernameField",
      role: "Concrete Colleague",
      kind: "class",
      x: 130,
      y: 140,
      description:
        "Holds the typed username. Knows nothing about the other widgets — it only reports changes to its mediator.",
    },
    {
      id: "password",
      label: "PasswordField",
      role: "Concrete Colleague",
      kind: "class",
      x: 130,
      y: 320,
      description:
        "Can be focused programmatically. Has no idea that a checkbox is what triggers that focus.",
    },
    {
      id: "checkbox",
      label: "RememberMeCheckbox",
      role: "Concrete Colleague",
      kind: "class",
      x: 670,
      y: 140,
      width: 190,
      description:
        "Tracks a checked/unchecked state and reports toggles to its mediator, nothing more.",
    },
    {
      id: "submit",
      label: "SubmitButton",
      role: "Concrete Colleague",
      kind: "class",
      x: 670,
      y: 320,
      description:
        "Can be enabled or disabled. It never decides this for itself — the mediator tells it when to flip.",
    },
  ],
  relations: [
    {
      id: "mediatorImpl",
      from: "dialog",
      to: "mediatorIface",
      type: "implements",
      description:
        "LoginDialog implements the Mediator interface; every colleague talks to it only through that interface.",
    },
    {
      id: "holds-username",
      from: "dialog",
      to: "username",
      type: "holds",
      label: "username",
      description:
        "The dialog constructs and owns the username field directly, handing itself to the field as its mediator.",
      bend: -20,
      code: "holds",
    },
    {
      id: "holds-password",
      from: "dialog",
      to: "password",
      type: "holds",
      label: "password",
      description: "The dialog constructs and owns the password field the same way.",
      bend: -20,
      code: "holds",
    },
    {
      id: "holds-checkbox",
      from: "dialog",
      to: "checkbox",
      type: "holds",
      label: "checkbox",
      description: "The dialog constructs and owns the remember-me checkbox.",
      bend: -20,
      code: "holds",
    },
    {
      id: "holds-submit",
      from: "dialog",
      to: "submit",
      type: "holds",
      label: "submit",
      description: "The dialog constructs and owns the submit button.",
      bend: -20,
      code: "holds",
    },
    {
      id: "notify-username",
      from: "username",
      to: "dialog",
      type: "calls",
      label: "notify()",
      description:
        "Whenever the username changes, the field calls notify(this, 'changed') on its mediator, passing itself as the sender — it never touches the submit button itself.",
      bend: 20,
      code: "username",
    },
    {
      id: "notify-checkbox",
      from: "checkbox",
      to: "dialog",
      type: "calls",
      label: "notify()",
      description:
        "Whenever the checkbox is toggled, it calls notify(this, 'toggled') on its mediator, passing itself as the sender — it never touches the password field itself.",
      bend: 20,
      code: "checkbox",
    },
    {
      id: "enable-submit",
      from: "dialog",
      to: "submit",
      type: "calls",
      label: "setEnabled()",
      description:
        "Having decided the username is non-empty, the dialog calls setEnabled() directly on the submit button it owns.",
      bend: 20,
      code: "enable",
    },
    {
      id: "focus-password",
      from: "dialog",
      to: "password",
      type: "calls",
      label: "focus()",
      description:
        "Having decided remember-me was checked, the dialog calls focus() directly on the password field it owns.",
      bend: 20,
      code: "focus",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Dialog implements the Mediator contract",
      description:
        "LoginDialog implements Mediator. Every widget that will talk to it only ever sees that narrow interface, never the concrete dialog class.",
      highlight: ["mediatorIface", "mediatorImpl", "dialog"],
      notes: { dialog: "implements Mediator" },
      code: "mediatorIface",
    },
    {
      title: "Colleagues are wired to the dialog",
      description:
        "LoginDialog constructs all four widgets, passing itself as the mediator to each. None of the widgets ever receives a reference to any of the others.",
      highlight: [
        "dialog",
        "holds-username",
        "holds-password",
        "holds-checkbox",
        "holds-submit",
        "username",
        "password",
        "checkbox",
        "submit",
      ],
      notes: { dialog: "wired: 4 widgets" },
      code: "holds",
    },
    {
      title: "User types a username",
      description:
        "UsernameField.type() stores the new value locally, then reports the change to its mediator instead of reaching for the submit button directly.",
      highlight: ["username", "notify-username", "dialog"],
      packets: [{ relation: "notify-username", label: "notify(this, 'changed')" }],
      notes: { username: 'value: "ada"' },
      code: "username",
    },
    {
      title: "Dialog routes the event",
      description:
        "LoginDialog.notify() checks whether sender is the widget it cares about — e.g. sender === this.username — together with the event, and decides what, if anything, needs to change elsewhere in the dialog.",
      highlight: ["dialog"],
      notes: { dialog: "routing event" },
      code: "notify",
    },
    {
      title: "Submit button gets enabled",
      description:
        "Because the username is non-empty, the dialog calls setEnabled(true) on the submit button. The username field and the submit button never learn of each other.",
      highlight: ["dialog", "enable-submit", "submit"],
      packets: [{ relation: "enable-submit", label: "setEnabled(true)" }],
      notes: { submit: "enabled" },
      code: "enable",
    },
    {
      title: 'User checks "remember me"',
      description:
        "Toggling the checkbox calls notify() again, this time with a different sender and event — the same single entry point handles every widget.",
      highlight: ["checkbox", "notify-checkbox", "dialog"],
      packets: [{ relation: "notify-checkbox", label: "notify(this, 'toggled')" }],
      notes: { checkbox: "checked" },
      code: "checkbox",
    },
    {
      title: "Dialog reacts again",
      description:
        "This time the dialog decides to move focus to the password field. The checkbox never knew that was even a possibility.",
      highlight: ["dialog", "focus-password", "password"],
      packets: [{ relation: "focus-password", label: "focus()" }],
      notes: { password: "focused" },
      code: "focus",
    },
    {
      title: "No widget knows about any other",
      description:
        "Every cross-widget rule lives inside LoginDialog, and each colleague only ever holds a reference typed as Mediator — never as LoginDialog itself. Wire the same four widgets to a different class that implements Mediator, and they would run against it unchanged.",
      highlight: ["username", "password", "checkbox", "submit", "dialog"],
      notes: { dialog: "central hub" },
      code: "dialog",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  // Generic diagram is used — no custom Visualization.
};
