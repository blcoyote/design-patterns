import type { ExplorableDefinition, Participant, Relation } from '@/types/pattern'

export type Selection = { kind: 'participant'; item: Participant } | { kind: 'relation'; item: Relation }

export function findSelection(pattern: ExplorableDefinition, id: string | null): Selection | null {
  if (!id) return null
  const participant = pattern.participants.find((p) => p.id === id)
  if (participant) return { kind: 'participant', item: participant }
  const relation = pattern.relations.find((r) => r.id === id)
  return relation ? { kind: 'relation', item: relation } : null
}
