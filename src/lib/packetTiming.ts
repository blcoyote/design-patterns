import type { Packet } from "@/types/pattern";

export function packetAnimationDuration(packets: Packet[], speed = 1): number {
  const depths: number[] = [];
  for (const packet of packets) {
    depths.push(packet.after === undefined ? 1 : depths[packet.after] + 1);
  }
  return Math.min(1.4, 2.8 / Math.max(1, ...depths)) / speed;
}
