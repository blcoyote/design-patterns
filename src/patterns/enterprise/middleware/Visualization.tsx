import { useMemo } from "react";
import { Diagram } from "@/components/viz/Diagram";
import type { Participant, Relation, VisualizationProps } from "@/types/pattern";

/**
 * The generic diagram draws one fixed order: Logging, Auth, Cache, Handler. The
 * "Order changes behaviour" step rebuilds the pipeline with the cache before auth, so
 * for that step this scene swaps the two boxes and re-points the arrows between them.
 * Every other step renders exactly what the generic diagram would.
 */
const REORDER_REGION = "reorder";

const reorderedNext =
  "In the rebuilt pipeline the cache is the second step and auth the third, so the cache sees the request before auth does.";

function swapped(participants: Participant[], relations: Relation[]) {
  const auth = participants.find((p) => p.id === "auth");
  const cache = participants.find((p) => p.id === "cache");
  if (!auth || !cache) return { participants, relations };
  return {
    participants: participants.map((p) => {
      if (p.id === "auth") return { ...p, role: cache.role, x: cache.x, y: cache.y };
      if (p.id === "cache") return { ...p, role: auth.role, x: auth.x, y: auth.y };
      return p;
    }),
    relations: relations.map((r) => {
      if (r.id === "toAuth") return { ...r, to: "cache", description: reorderedNext };
      if (r.id === "toCache")
        return { ...r, from: "cache", to: "auth", description: reorderedNext };
      if (r.id === "toHandler") return { ...r, from: "auth", description: reorderedNext };
      return r;
    }),
  };
}

export function MiddlewareVisualization({
  pattern,
  color,
  step,
  stepIndex,
  speed,
  selectedId,
  onSelect,
}: VisualizationProps) {
  const reordered = step?.code === REORDER_REGION;
  const scene = useMemo(
    () =>
      reordered
        ? swapped(pattern.participants, pattern.relations)
        : { participants: pattern.participants, relations: pattern.relations },
    [reordered, pattern.participants, pattern.relations],
  );

  return (
    <Diagram
      participants={scene.participants}
      relations={scene.relations}
      color={color}
      viewBox={pattern.viewBox}
      highlight={step?.highlight}
      packets={step?.packets}
      notes={step?.notes}
      selectedId={selectedId}
      onSelect={onSelect}
      animationKey={stepIndex}
      packetSpeed={speed}
      ariaLabel={`${pattern.name} diagram`}
    />
  );
}
