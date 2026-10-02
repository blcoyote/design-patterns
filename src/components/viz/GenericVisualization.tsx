import { categories } from '@/patterns/categories'
import type { VisualizationProps } from '@/types/pattern'
import { Diagram } from './Diagram'

/** Default visualisation: renders the pattern's participants/relations/steps as a diagram. */
export function GenericVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  return (
    <Diagram
      participants={pattern.participants}
      relations={pattern.relations}
      color={categories[pattern.category].color}
      viewBox={pattern.viewBox}
      highlight={step?.highlight}
      packets={step?.packets}
      notes={step?.notes}
      selectedId={selectedId}
      onSelect={onSelect}
      animationKey={stepIndex}
      ariaLabel={`${pattern.name} diagram`}
    />
  )
}
