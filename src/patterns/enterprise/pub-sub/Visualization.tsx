import { useMemo, useState } from "react";
import { Diagram } from "@/components/viz/Diagram";
import type { Packet, Step, VisualizationProps } from "@/types/pattern";

/**
 * Pub/Sub keeps the generic Publisher → EventBus → Subscriber diagram, but adds
 * two translucent "topic lanes" behind it (order.placed / user.signedUp) so the
 * broker's job — routing a message to only the subscribers of its topic, leaving
 * everyone else dim — reads as a lane a message travels along rather than just an
 * arrow. A "Try it" row lets the visitor publish to either topic directly,
 * independent of the step player, and see exactly who reacts.
 */

type TopicId = "order.placed" | "user.signedUp";
const TOPICS: TopicId[] = ["order.placed", "user.signedUp"];

/** Which participant publishes each topic, and the relation that carries the call. */
const TOPIC_PUBLISHER: Record<TopicId, { participant: string; relation: string }> = {
  "order.placed": {
    participant: "checkoutService",
    relation: "checkout-publish",
  },
  "user.signedUp": { participant: "userService", relation: "user-publish" },
};

/** Every subscriber and the topics it registered a handler for. */
const SUBSCRIPTIONS: Record<string, TopicId[]> = {
  emailService: ["order.placed", "user.signedUp"],
  analyticsService: ["order.placed", "user.signedUp"],
  inventoryService: ["order.placed"],
};

/** The notify relation the bus uses to reach a given subscriber for a given topic. */
const NOTIFY_RELATION: Record<string, Partial<Record<TopicId, string>>> = {
  emailService: {
    "order.placed": "notify-email-order",
    "user.signedUp": "notify-email-user",
  },
  analyticsService: {
    "order.placed": "notify-analytics-order",
    "user.signedUp": "notify-analytics-user",
  },
  inventoryService: { "order.placed": "notify-inventory-order" },
};

/** y-position of each topic's lane in the 800×460 viewBox, aligned with its publisher. */
const LANE_Y: Record<TopicId, number> = {
  "order.placed": 150,
  "user.signedUp": 330,
};

/** Title of the narrative step after which InventoryService is no longer subscribed. */
const UNSUBSCRIBE_STEP_TITLE = "InventoryService unsubscribes";

/**
 * Builds a full "publish this topic" step from the subscription table, so it stays in sync with the
 * diagram data. `inventoryUnsubscribed` mirrors the live subscription state at the current step.
 */
function scenarioStep(topic: TopicId, inventoryUnsubscribed: boolean): Step {
  const pub = TOPIC_PUBLISHER[topic];
  const subscriberIds = Object.keys(SUBSCRIPTIONS);
  const reached = subscriberIds.filter(
    (id) =>
      SUBSCRIPTIONS[id].includes(topic) && !(id === "inventoryService" && inventoryUnsubscribed),
  );

  const highlight = [
    pub.participant,
    pub.relation,
    "eventBus",
    ...reached.flatMap((id) => [NOTIFY_RELATION[id][topic]!, id]),
  ];
  const packets: Packet[] = [
    { relation: pub.relation, label: topic },
    ...reached.map((id) => ({
      relation: NOTIFY_RELATION[id][topic]!,
      label: topic,
      after: 0,
    })),
  ];
  const notes: Record<string, string> = { eventBus: `${topic} ▶` };
  for (const id of subscriberIds) {
    notes[id] = reached.includes(id) ? "notified ✓" : "not subscribed";
  }

  return {
    title: `Try: publish ${topic}`,
    description: `${pub.participant} publishes to "${topic}". The bus calls only the handlers registered for that topic — ${reached.length} of ${subscriberIds.length} subscribers react.`,
    highlight,
    packets,
    notes,
    code: "dispatch",
  };
}

/** Which topic a narrative step's highlight set is "about", for keeping the Try-it row in sync while the player runs. */
function topicFromStep(step: Step | null): TopicId | null {
  if (!step) return null;
  for (const topic of TOPICS) {
    if (step.highlight.includes(TOPIC_PUBLISHER[topic].relation)) return topic;
  }
  return null;
}

export function PubSubVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  // Tag the override with the step it was picked on, so it falls back to "no
  // override" (the real narrative step) as soon as the step player moves on.
  const [pickedOverride, setPickedOverride] = useState<{
    forStep: number;
    topic: TopicId;
  } | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  const override = pickedOverride?.forStep === stepIndex ? pickedOverride.topic : null;

  const unsubscribeIndex = pattern.steps.findIndex((s) => s.title === UNSUBSCRIBE_STEP_TITLE);
  const inventoryUnsubscribed = unsubscribeIndex !== -1 && stepIndex >= unsubscribeIndex;
  const effectiveStep = override ? scenarioStep(override, inventoryUnsubscribed) : step;
  const activeTopic = override ?? topicFromStep(step);
  const animationKey = override ? `override-${override}-${replayToken}` : stepIndex;

  const laneColor = useMemo<Record<TopicId, string>>(
    () => ({ "order.placed": color, "user.signedUp": "var(--color-info)" }),
    [color],
  );

  function publish(topic: TopicId) {
    setPickedOverride({ forStep: stepIndex, topic });
    setReplayToken((t) => t + 1);
    onSelect(TOPIC_PUBLISHER[topic].participant);
  }

  const underlay = (
    <g pointerEvents="none">
      {TOPICS.map((topic) => {
        const isActive = activeTopic === topic;
        return (
          <g key={topic}>
            <rect
              x={40}
              y={LANE_Y[topic] - 28}
              width={720}
              height={56}
              rx={28}
              fill={laneColor[topic]}
              opacity={isActive ? 0.14 : 0.06}
              className="transition-opacity duration-300"
            />
            <text
              x={52}
              y={LANE_Y[topic] - 36}
              className="font-mono text-[10px] tracking-wider uppercase select-none"
              fill={isActive ? laneColor[topic] : "var(--color-fg-subtle)"}
            >
              topic: {topic}
            </text>
          </g>
        );
      })}
    </g>
  );

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={effectiveStep?.highlight}
        packets={effectiveStep?.packets}
        packetSpeed={speed}
        notes={effectiveStep?.notes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={animationKey}
        underlay={underlay}
        ariaLabel={`${pattern.name} diagram`}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-fg-subtle">
          Try it
        </span>
        {TOPICS.map((topic) => {
          const isActive = activeTopic === topic;
          return (
            <button
              key={topic}
              type="button"
              aria-pressed={isActive}
              aria-label={`Publish to topic ${topic}`}
              onClick={(e) => {
                e.stopPropagation();
                publish(topic);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-focus ${
                isActive
                  ? "text-fg-on-accent ring-transparent"
                  : "text-fg-soft ring-line-strong hover:bg-surface-raised hover:text-fg"
              }`}
              style={isActive ? { backgroundColor: laneColor[topic] } : undefined}
            >
              Publish {topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}
