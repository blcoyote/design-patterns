import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { EdgeGeometry } from "@/lib/geometry";
import {
  PACKET_HOP,
  PACKET_REPEAT_DELAY,
  PACKET_STAGGER,
  packetAnimationDuration,
} from "@/lib/packetTiming";
import type { Packet as PacketDef } from "@/types/pattern";
import { Packet } from "./Packet";

interface PacketLayerProps {
  packets: PacketDef[];
  geometry: Map<string, EdgeGeometry> | Record<string, EdgeGeometry>;
  color: string;
  speed?: number;
  animationKey?: string | number;
  stagger?: number;
}

export function PacketLayer(props: PacketLayerProps) {
  const reduceMotion = !!useReducedMotion();
  return (
    <PacketCycle
      key={`${props.animationKey}-${props.speed}-${reduceMotion}`}
      {...props}
      reduceMotion={reduceMotion}
    />
  );
}

function PacketCycle({
  packets,
  geometry,
  color,
  speed = 1,
  stagger = PACKET_STAGGER,
  reduceMotion,
}: PacketLayerProps & { reduceMotion: boolean }) {
  const sequenced = packets.some((packet) => packet.after !== undefined);
  const [completed, setCompleted] = useState<number[]>([]);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!sequenced || reduceMotion || completed.length !== packets.length)
      return;
    const timeout = window.setTimeout(() => {
      setCompleted([]);
      setCycle((current) => current + 1);
    }, (PACKET_REPEAT_DELAY * 1000) / speed);
    return () => window.clearTimeout(timeout);
  }, [sequenced, reduceMotion, completed.length, packets.length, speed]);

  return (
    <g key={cycle}>
      {packets.map((packet, index) => {
        const edge =
          geometry instanceof Map
            ? geometry.get(packet.relation)
            : geometry[packet.relation];
        if (!edge) return null;
        if (
          reduceMotion &&
          sequenced &&
          packets.some((next) => next.after === index)
        )
          return null;
        if (
          !reduceMotion &&
          packet.after !== undefined &&
          !completed.includes(packet.after)
        )
          return null;
        return (
          <Packet
            key={`${packet.relation}-${index}`}
            geometry={edge}
            color={color}
            label={packet.label}
            reverse={packet.reverse}
            delay={sequenced ? 0 : (index * stagger) / speed}
            duration={
              sequenced
                ? packetAnimationDuration(packets, speed)
                : PACKET_HOP / speed
            }
            repeat={!sequenced}
            repeatDelay={PACKET_REPEAT_DELAY / speed}
            onComplete={
              sequenced
                ? () =>
                    setCompleted((current) =>
                      current.includes(index) ? current : [...current, index],
                    )
                : undefined
            }
          />
        );
      })}
    </g>
  );
}
