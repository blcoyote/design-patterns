import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import { StateVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "state",
  name: "State",
  category: "behavioral",
  order: 5,
  summary:
    "Let an object change its behavior by swapping the internal state object that defines it.",
  intent:
    'Let an object change its behaviour when its internal state changes, by handing the work to a separate object for each state.',
  problem:
    'A document behaves differently depending on its workflow stage: submit() should mean something different in Draft, InReview, Published or Rejected. If you handle this in one method full of if (status === "draft") … else if (status === "inReview") … checks, that method grows with every new stage or action. Nothing stops a caller from triggering a transition that should be impossible, either.',
  solution:
    "Give every stage its own class that implements a shared DocumentState interface, and let Document hold just a reference to its current state. Each method on Document (submit, approve, reject, revise) simply forwards to the same method on whichever state object is current. That state object decides what happens, including which state replaces it. Document itself never checks which stage it is in.",
  analogy:
    "A vending machine acts differently depending on whether it is idle, has enough coins, or is dispensing. The same button press does something different in each state, and the machine moves itself to the next state once the action is done.",
  whenToUse: [
    'An object behaves differently depending on an internal "mode" or "stage", and this affects many of its methods.',
    "You have methods full of conditionals that all check the same status field.",
    "You want the rules for moving between states enforced in one place, not scattered across every caller.",
  ],
  pros: [
    "Replaces sprawling conditionals with small, focused classes, one per state.",
    "Each state decides which actions it accepts. Invalid ones are absorbed (or could throw) instead of being handled ad hoc by callers.",
    "State-specific behaviour lives in one class. Adding a state still means updating every existing state that can move into it.",
  ],
  cons: [
    "Overkill for objects with only two or three simple states.",
    "The overall state machine is spread across several classes, so the big picture is harder to see at a glance.",
    "Each state must know which states it can hand off to, so the states are coupled to one another.",
  ],
  realWorld: [
    "TCP connection states (Listen, SynReceived, Established, Closed, …)",
    "Media players: a playback engine’s Stopped/Playing/Paused/Buffering states",
    "Game character states (Standing, Jumping, Crouching, Dead)",
    "Document and order workflow engines (Draft → InReview → Published/Rejected)",
  ],
  related: ["strategy", "circuit-breaker", "singleton", "flyweight", "bridge"],
  participants: [
    {
      id: "documentState",
      label: "DocumentState",
      role: "State interface",
      kind: "interface",
      x: 450,
      y: 65,
      description:
        "Declares one method per action (submit, approve, reject, revise). Document depends only on this — never on a concrete state class.",
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 120,
      y: 250,
      description:
        "Drives the workflow by calling submit(), approve(), reject() or revise() on the document — it never checks which stage the document is in first.",
    },
    {
      id: "document",
      label: "Document",
      role: "Context",
      kind: "class",
      x: 400,
      y: 250,
      width: 170,
      description:
        "Holds a reference to its current DocumentState and forwards every action to it. Its status getter just reads state.name — it never branches on the stage itself.",
    },
    {
      id: "draft",
      label: "DraftState",
      role: "Concrete State",
      kind: "class",
      x: 680,
      y: 100,
      description:
        "The starting state. submit() is the only transition it honors, and it returns a new InReviewState.",
    },
    {
      id: "review",
      label: "InReviewState",
      role: "Concrete State",
      kind: "class",
      x: 700,
      y: 250,
      description:
        "Reached after submission. approve() moves on to PublishedState; reject() moves to RejectedState — the two valid outcomes of a review.",
    },
    {
      id: "published",
      label: "PublishedState",
      role: "Concrete State",
      kind: "class",
      x: 680,
      y: 400,
      description:
        "A terminal state: every action is a no-op, since a published document has nothing left to transition to.",
    },
    {
      id: "rejected",
      label: "RejectedState",
      role: "Concrete State",
      kind: "class",
      x: 430,
      y: 400,
      description:
        "Reached after a rejected review. revise() is its only valid transition, sending the document back to DraftState for another pass.",
    },
  ],
  relations: [
    {
      id: "holds",
      from: "document",
      to: "documentState",
      type: "holds",
      label: "state",
      description:
        "Document stores its current state typed only as DocumentState — never as a concrete state class. This is what keeps it decoupled.",
      code: "holds",
    },
    {
      id: "draft-impl",
      from: "draft",
      to: "documentState",
      type: "implements",
      description: "DraftState implements DocumentState.",
    },
    {
      id: "review-impl",
      from: "review",
      to: "documentState",
      type: "implements",
      description: "InReviewState implements DocumentState.",
      bend: -30,
    },
    {
      id: "published-impl",
      from: "published",
      to: "documentState",
      type: "implements",
      description: "PublishedState implements DocumentState.",
      bend: 55,
    },
    {
      id: "rejected-impl",
      from: "rejected",
      to: "documentState",
      type: "implements",
      description: "RejectedState implements DocumentState.",
      bend: -55,
    },
    {
      id: "client-call",
      from: "client",
      to: "document",
      type: "calls",
      label: "action()",
      description:
        "The client always calls the same handful of methods on Document — submit, approve, reject, revise — no matter which state is currently active.",
      code: "delegate",
    },
    {
      id: "handle-draft",
      from: "document",
      to: "draft",
      type: "calls",
      label: "submit()",
      description:
        "When DraftState is current, Document forwards submit() to it.",
      code: "delegate",
    },
    {
      id: "handle-review",
      from: "document",
      to: "review",
      type: "calls",
      label: "approve()/reject()",
      description:
        "When InReviewState is current, Document forwards approve() or reject() to it.",
      code: "delegate",
    },
    {
      id: "handle-rejected",
      from: "document",
      to: "rejected",
      type: "calls",
      label: "revise()",
      description:
        "When RejectedState is current, Document forwards revise() to it.",
      code: "delegate",
      bend: -20,
    },
    {
      id: "handle-published",
      from: "document",
      to: "published",
      type: "calls",
      label: "submit()",
      description:
        "When PublishedState is current, Document forwards any action to it — and PublishedState quietly ignores it.",
      code: "delegate",
    },
    {
      id: "draft-to-review",
      from: "draft",
      to: "review",
      type: "creates",
      label: "⇒ InReview",
      description:
        "DraftState.submit() returns a brand new InReviewState, which Document adopts as its current state.",
      code: "submit",
    },
    {
      id: "review-to-published",
      from: "review",
      to: "published",
      type: "creates",
      label: "⇒ Published",
      description: "InReviewState.approve() returns a new PublishedState.",
      code: "approve",
    },
    {
      id: "review-to-rejected",
      from: "review",
      to: "rejected",
      type: "creates",
      label: "⇒ Rejected",
      description: "InReviewState.reject() returns a new RejectedState.",
      code: "reject",
      bend: 30,
    },
    {
      id: "rejected-to-draft",
      from: "rejected",
      to: "draft",
      type: "creates",
      label: "⇒ Draft",
      description:
        "RejectedState.revise() returns a brand new DraftState, looping the document back to the start.",
      code: "revise",
      bend: -40,
    },
  ],
  steps: [
    {
      title: "A new document starts in Draft",
      description:
        "Document is constructed with its state field pointing at a fresh DraftState. DocumentState, the interface, is all Document ever knows about it.",
      highlight: ["document", "holds", "draft"],
      notes: { document: "state: Draft" },
      code: "document",
    },
    {
      title: "The author calls submit()",
      description:
        "The client calls document.submit(). Document does not ask what stage it is in — it just forwards the call to whatever state object it currently holds.",
      highlight: ["client", "client-call", "draft"],
      packets: [{ relation: "client-call", label: "submit()" }],
      code: "delegate",
    },
    {
      title: "DraftState hands off to InReviewState",
      description:
        "DraftState.submit() returns a new InReviewState, and Document stores it as the current state. The decision to move forward — and to what — was made entirely inside DraftState.",
      highlight: ["handle-draft", "draft-to-review", "review"],
      packets: [
        { relation: "handle-draft", label: "submit()" },
        { relation: "draft-to-review", label: "⇒ InReview", after: 0 },
      ],
      notes: { document: "state: InReview" },
      code: "submit",
    },
    {
      title: "A reviewer calls reject()",
      description:
        "The client calls document.reject(). Document forwards it to InReviewState — the only state where reject() means anything.",
      highlight: ["client", "client-call", "review"],
      packets: [{ relation: "client-call", label: "reject()" }],
      code: "delegate",
    },
    {
      title: "InReviewState hands off to RejectedState",
      description:
        "InReviewState.reject() returns a new RejectedState. A review can end in approval or rejection — InReviewState is the only place that decision gets made.",
      highlight: ["handle-review", "review-to-rejected", "rejected"],
      packets: [
        { relation: "handle-review", label: "reject()" },
        { relation: "review-to-rejected", label: "⇒ Rejected", after: 0 },
      ],
      notes: { document: "state: Rejected" },
      code: "reject",
    },
    {
      title: "The author revises and calls revise()",
      description:
        "The client calls document.revise(). Only RejectedState does anything useful with it — every other state would just ignore the call.",
      highlight: ["client", "client-call", "rejected"],
      packets: [{ relation: "client-call", label: "revise()" }],
      code: "delegate",
    },
    {
      title: "RejectedState sends it back to Draft",
      description:
        "RejectedState.revise() returns a brand new DraftState, looping the document back to the start of the workflow for another pass.",
      highlight: ["handle-rejected", "rejected-to-draft", "draft"],
      packets: [
        { relation: "handle-rejected", label: "revise()" },
        { relation: "rejected-to-draft", label: "⇒ Draft", after: 0 },
      ],
      notes: { document: "state: Draft" },
      code: "revise",
    },
    {
      title: "Resubmitted, and this time approved",
      description:
        "The author submits again — Draft to InReview, exactly as before. A different reviewer then calls approve(), and InReviewState this time returns PublishedState.",
      highlight: [
        "handle-draft",
        "draft-to-review",
        "handle-review",
        "review-to-published",
        "published",
      ],
      packets: [
        { relation: "handle-draft", label: "submit()" },
        { relation: "handle-review", label: "approve()", after: 0 },
        { relation: "review-to-published", label: "⇒ Published", after: 1 },
      ],
      notes: { document: "state: Published" },
      code: "approve",
    },
    {
      title: "Published ignores further calls",
      description:
        "A later submit() reaches PublishedState, whose submit() just returns itself — nothing happens. Document never special-cased this; the state object quietly absorbed an invalid transition.",
      highlight: ["client", "client-call", "handle-published", "published"],
      packets: [
        { relation: "client-call", label: "submit()" },
        { relation: "handle-published", label: "submit()", after: 0 },
      ],
      notes: { published: "no-op" },
      code: "published",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  Visualization: StateVisualization,
};
