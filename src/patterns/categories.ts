import type { Category } from '@/types/pattern'

export interface CategoryMeta {
  id: Category
  label: string
  description: string
  /** Hex colour used inside SVG visualisations. */
  color: string
  /** Tailwind classes (kept as literals so Tailwind can detect them). */
  badge: string
  dot: string
  text: string
}

export const categories: Record<Category, CategoryMeta> = {
  creational: {
    id: 'creational',
    label: 'Creational',
    description: 'How objects get created — hiding construction details and controlling instances.',
    color: '#34d399',
    badge: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  structural: {
    id: 'structural',
    label: 'Structural',
    description: 'How objects and classes are composed into larger structures.',
    color: '#38bdf8',
    badge: 'bg-sky-400/10 text-sky-300 ring-sky-400/30',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
  },
  behavioral: {
    id: 'behavioral',
    label: 'Behavioral',
    description: 'How objects communicate and share responsibilities.',
    color: '#c084fc',
    badge: 'bg-purple-400/10 text-purple-300 ring-purple-400/30',
    dot: 'bg-purple-400',
    text: 'text-purple-300',
  },
}

export const categoryOrder: Category[] = ['creational', 'structural', 'behavioral']
