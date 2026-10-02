import { motion, useReducedMotion } from 'motion/react'
import { pointOnQuad, samplePath, type EdgeGeometry } from '@/lib/geometry'

export interface PacketProps {
  geometry: EdgeGeometry
  color: string
  label?: string
  reverse?: boolean
  /** Seconds before this packet starts moving (for staggering). */
  delay?: number
}

/** A glowing dot (with optional label) that travels along an edge, repeating. */
export function Packet({ geometry, color, label, reverse, delay = 0 }: PacketProps) {
  const reduceMotion = useReducedMotion()
  const points = samplePath(geometry, 24, reverse)

  const body = (
    <>
      <circle r={7} fill={color} filter="url(#glow)" />
      <circle r={3} fill="#ffffff" />
      {label && (
        <g transform="translate(0 -18)">
          <rect x={-(label.length * 3.4 + 7)} y={-9} width={label.length * 6.8 + 14} height={18} rx={9} fill={color} />
          <text y={4} textAnchor="middle" className="fill-slate-950 text-[11px] font-mono font-semibold select-none">
            {label}
          </text>
        </g>
      )}
    </>
  )

  if (reduceMotion) {
    const mid = pointOnQuad(geometry.start, geometry.control, geometry.end, 0.5)
    return (
      <g transform={`translate(${mid.x} ${mid.y})`} pointerEvents="none">
        {body}
      </g>
    )
  }

  return (
    <motion.g
      pointerEvents="none"
      initial={{ x: points[0].x, y: points[0].y, opacity: 0 }}
      animate={{
        x: points.map((p) => p.x),
        y: points.map((p) => p.y),
        opacity: [0, ...Array(points.length - 2).fill(1), 0],
      }}
      transition={{ duration: 1.4, delay, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.9 }}
    >
      {body}
    </motion.g>
  )
}
