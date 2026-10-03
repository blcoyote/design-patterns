import type { Packet, Step } from "@/types/pattern";

/** Seconds one packet takes to travel its edge at speed 1. */
export const PACKET_HOP = 1.4;
/** Seconds between independent (unsequenced) packets starting at speed 1. */
export const PACKET_STAGGER = 0.18;
/** Seconds a packet (or a finished chain) pauses before it plays again, at speed 1. */
export const PACKET_REPEAT_DELAY = 0.9;
/** Time a step stays on screen at speed 1, in ms, when its packets finish sooner. */
export const BASE_STEP_INTERVAL = 3200;
/** Pause after the last packet lands before the player advances, in ms at speed 1. */
const STEP_SETTLE = 800;

/** How long a single packet's journey lasts. Every hop of a chain gets the same, readable duration. */
export function packetAnimationDuration(_packets: Packet[], speed = 1): number {
  return PACKET_HOP / speed;
}

/** Number of hops in the longest `after` chain (1 for a step with only independent packets). */
export function packetChainDepth(packets: Packet[]): number {
  const depths: number[] = [];
  for (const packet of packets) {
    depths.push(packet.after === undefined ? 1 : depths[packet.after] + 1);
  }
  return Math.max(0, ...depths);
}

/** Seconds from the start of a step until its last packet has finished its first journey. */
export function packetTimeline(packets: Packet[], speed = 1): number {
  if (packets.length === 0) return 0;
  const sequenced = packets.some((packet) => packet.after !== undefined);
  const seconds = sequenced
    ? packetChainDepth(packets) * PACKET_HOP
    : (packets.length - 1) * PACKET_STAGGER + PACKET_HOP;
  return seconds / speed;
}

/**
 * How long the player stays on a step, in ms: the base interval, stretched so that every
 * packet has run at least once (plus a short settle) before the next step starts.
 */
export function stepDuration(step: Step | undefined, speed = 1): number {
  const packets = step?.packets ?? [];
  const needed = packets.length
    ? packetTimeline(packets) * 1000 + STEP_SETTLE
    : 0;
  return Math.max(BASE_STEP_INTERVAL, needed) / speed;
}
