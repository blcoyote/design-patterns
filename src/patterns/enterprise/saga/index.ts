import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "saga",
  name: "Saga",
  category: "enterprise",
  order: 12,
  summary:
    "Coordinate a multi-step transaction across services as a sequence of local steps, undoing completed steps with compensating actions if a later one fails.",
  intent:
    "Give the many local transactions that make up one business operation the same all-or-nothing feel as a single ACID transaction, without ever holding a distributed lock: each step commits on its own, and if a later step fails, the steps that already committed are undone by explicit compensating actions instead of a database rollback.",
  problem:
    "Placing an order touches separate services, each with its own database: reserve stock, charge a card, schedule shipping. There is no distributed transaction that can commit or roll back all three together. If charging the card fails after stock was already reserved, something has to undo that reservation, and nothing does so automatically — the system is left holding stock for an order that was never paid for.",
  solution:
    "Model the whole operation as a saga: an ordered sequence of local transactions, with each reversible step paired with a compensating action. An orchestrator (shown here) runs the steps one after another and remembers, as each one succeeds, which compensation is now available. If a step fails, the orchestrator runs the available compensations in reverse order to restore the corresponding business state as far as possible; because compensations are transactions that may fail or be observed, this is not a guarantee of returning to the exact starting state. (The alternative, choreography, has each service react to the previous one's event and publish its own compensating event, with no central orchestrator driving the sequence.)",
  analogy:
    "A travel agent books a flight, a hotel and a rental car as one trip. If the car rental turns out to be unavailable, the agent doesn't leave the flight and hotel booked and walk away — they call the airline and the hotel back and cancel those bookings too, undoing what was already done instead of pretending the whole trip never happened.",
  whenToUse: [
    "A business operation spans multiple services or databases that cannot share one ACID transaction.",
    "Each step can be given an explicit undo — a compensating action that reverses its effect, like release for reserve or refund for charge.",
    "You want one place that reads as the whole business process end-to-end, which favors orchestration over choreography.",
  ],
  pros: [
    "Each step commits locally and quickly; no distributed lock or two-phase commit is ever held across services.",
    "A failed step is followed by an explicit, auditable rollback instead of an inconsistent half-done operation.",
    "The orchestrator is one place to read the entire business process, unlike choreography where the flow is spread across every service's own event handlers.",
  ],
  cons: [
    "Compensations are not true rollbacks: once a step's effects may have been observed elsewhere, undoing it is itself a business operation that can fail or take time (a refund settles in days, not milliseconds).",
    "The saga is eventually consistent, not atomic — a reader can see stock reserved but the card not yet charged, a state that could never occur inside a single ACID transaction.",
    "The orchestrator is a central dependency every step reports to, and every service call it coordinates must be safe to retry (idempotent), since a crash mid-saga means some steps may run again.",
  ],
  realWorld: [
    "Chris Richardson's microservices.io saga pattern (orchestration-based)",
    "AWS Step Functions and Azure Durable Functions used to drive saga-style workflows",
    "Camunda and Netflix Conductor process-orchestration engines",
    "E-commerce checkout flows coordinating inventory, payment and shipping services",
  ],
  related: ["outbox", "command", "state", "unit-of-work"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "orchestrator",
      label: "OrderSagaOrchestrator",
      role: "Orchestrator (process manager)",
      kind: "class",
      x: 400,
      y: 90,
      width: 220,
      description:
        "Drives the whole saga: calls each step in order, and as each one succeeds, remembers its compensating action. If a step throws, it runs the compensations it has collected so far, in reverse order, and reports the order rolled back.",
    },
    {
      id: "inventoryService",
      label: "InventoryService",
      role: "Step 1 + compensation",
      kind: "class",
      x: 140,
      y: 320,
      width: 200,
      description:
        "Reserve holds stock for an order; Release — its compensating action — frees that hold. Release only has an effect if Reserve actually ran for that order.",
    },
    {
      id: "paymentService",
      label: "PaymentService",
      role: "Step 2 + compensation",
      kind: "class",
      x: 400,
      y: 320,
      width: 200,
      description:
        "Charge takes payment for an order; Refund — its compensating action — returns it. The orchestrator only ever queues Refund once Charge has actually succeeded.",
    },
    {
      id: "shippingService",
      label: "ShippingService",
      role: "Step 3 (final)",
      kind: "class",
      x: 660,
      y: 320,
      width: 200,
      description:
        "Ships the order. It is the last step, so it has no compensating action of its own — if it fails, there is nothing to undo here, only the earlier steps.",
    },
  ],
  relations: [
    {
      id: "reserve",
      from: "orchestrator",
      to: "inventoryService",
      type: "calls",
      label: "reserve()",
      description: "Step 1: hold the requested quantity of stock for this order.",
      code: "reserve",
    },
    {
      id: "charge",
      from: "orchestrator",
      to: "paymentService",
      type: "calls",
      label: "charge()",
      description: "Step 2: charge the order's total to the customer's card.",
      code: "charge",
    },
    {
      id: "ship",
      from: "orchestrator",
      to: "shippingService",
      type: "calls",
      label: "ship()",
      description: "Step 3: hand the order to the carrier.",
      code: "ship",
    },
    {
      id: "release",
      from: "orchestrator",
      to: "inventoryService",
      type: "calls",
      label: "release()",
      description:
        "Compensation for step 1, run only if a later step fails: frees the stock that reserve() held.",
      code: "release",
      bend: 60,
    },
    {
      id: "refund",
      from: "orchestrator",
      to: "paymentService",
      type: "calls",
      label: "refund()",
      description:
        "Compensation for step 2, run only if a step after charge() fails: returns the money that was taken.",
      code: "refund",
      bend: -60,
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Order A1 runs every step",
      description:
        "The orchestrator calls reserve(), then charge(), then ship() for order A1. Each one succeeds, so no compensation is ever queued for use — the saga needs none of them.",
      highlight: [
        "orchestrator",
        "reserve",
        "inventoryService",
        "charge",
        "paymentService",
        "ship",
        "shippingService",
      ],
      packets: [
        { relation: "reserve", label: "reserve A1" },
        { relation: "charge", label: "charge A1", after: 0 },
        { relation: "ship", label: "ship A1", after: 1 },
      ],
      notes: {
        inventoryService: "reserved A1",
        paymentService: "charged A1",
        shippingService: "shipped A1",
      },
      code: "runSteps",
    },
    {
      title: "A1 completes",
      description:
        "All three steps succeeded in order, so the orchestrator reports the order completed. No rollback was needed because nothing failed.",
      highlight: ["orchestrator"],
      notes: { orchestrator: "A1 completed" },
      code: "runSteps",
    },
    {
      title: "Order A2: stock is reserved, then the charge fails",
      description:
        "For A2 the orchestrator reserves stock successfully and queues release() as its compensation. The charge is declined, so ship() never runs at all.",
      highlight: ["orchestrator", "reserve", "inventoryService", "charge", "paymentService"],
      packets: [
        { relation: "reserve", label: "reserve A2" },
        { relation: "charge", label: "charge A2 ✗", after: 0 },
      ],
      notes: { inventoryService: "reserved A2", paymentService: "declined" },
      code: "charge",
    },
    {
      title: "Compensating A2: release the stock",
      description:
        "Only one step had succeeded before the failure, so there is only one compensation queued: release(). The orchestrator calls it to free A2's stock hold.",
      highlight: ["orchestrator", "release", "inventoryService"],
      packets: [{ relation: "release", label: "release A2", reverse: true }],
      notes: { inventoryService: "released A2" },
      code: "compensate",
    },
    {
      title: "A2 rolled back",
      description:
        "The stock hold is undone and the (failed) charge was never queued for refund — nothing was ever charged. The system is back to where it was before A2 was placed.",
      highlight: ["orchestrator"],
      notes: { orchestrator: "A2 rolled back" },
      code: "compensate",
    },
    {
      title: "Order A3: reserve and charge succeed, shipping fails",
      description:
        "For A3 both reserve() and charge() succeed, each queuing its own compensation. Then ship() fails — the carrier rejects the package — with two completed steps now needing to be undone.",
      highlight: [
        "orchestrator",
        "reserve",
        "inventoryService",
        "charge",
        "paymentService",
        "ship",
        "shippingService",
      ],
      packets: [
        { relation: "reserve", label: "reserve A3" },
        { relation: "charge", label: "charge A3", after: 0 },
        { relation: "ship", label: "ship A3 ✗", after: 1 },
      ],
      notes: {
        inventoryService: "reserved A3",
        paymentService: "charged A3",
        shippingService: "rejected",
      },
      code: "ship",
    },
    {
      title: "Compensating A3 in reverse: refund, then release",
      description:
        "Two compensations are queued, most recent first: refund() for the charge, release() for the reservation. The orchestrator runs them in that order — last succeeded step undone first.",
      highlight: ["orchestrator", "refund", "paymentService", "release", "inventoryService"],
      packets: [
        { relation: "refund", label: "refund A3", reverse: true },
        { relation: "release", label: "release A3", reverse: true, after: 0 },
      ],
      notes: { paymentService: "refunded A3", inventoryService: "released A3" },
      code: "compensate",
    },
    {
      title: "A3 rolled back — nothing left half-done",
      description:
        "Both completed steps were undone in the right order before the orchestrator reported A3 rolled back. No distributed transaction ever existed across the three services; the saga's compensations did the same job explicitly.",
      highlight: ["orchestrator", "inventoryService", "paymentService", "shippingService"],
      code: "orchestrator",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
