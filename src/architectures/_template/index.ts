/**
 * TEMPLATE — copy this folder to `src/architectures/<paradigm>/<your-slug>/` and fill it in.
 * Folders starting with "_" are ignored by the registry, so this file never shows up on the site.
 * See README.md → "Adding an architecture" for details.
 */
import type { ArchitectureDefinition } from '@/types/architecture'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import pyExample from './example.py?raw'

export const architecture: ArchitectureDefinition = {
  slug: 'my-architecture', // must match the folder name; used in the URL (/architecture/my-architecture)
  name: 'My Architecture',
  paradigm: 'oo', // 'oo' | 'functional' | 'both'
  order: 99, // position in the architecture index
  summary: 'One line shown on cards and in search.',
  intent: 'The one-paragraph intent statement.',
  problem: 'What goes wrong without this architecture?',
  solution: 'How the architecture solves it.',
  analogy: 'A real-world analogy.',
  whenToUse: ['…'],
  pros: ['…'],
  cons: ['…'],
  realWorld: ['…'],
  concepts: [{ term: 'Term', description: 'What it means in this architecture.' }],
  // variants: [{ name: 'Variant name', description: 'How it differs.' }],

  commonlyUsedWith: {
    // Design patterns this architecture is typically built with. Each slug must also be
    // referenced by at least one `participant.patterns` entry below (enforced by validate.ts).
    designPatterns: [{ slug: 'repository', why: 'Why this architecture commonly uses the Repository pattern.' }],
    // Sibling architectures. Must be declared symmetrically: if A lists B, B must list A
    // (enforced by architectures/registry.test.ts).
    architectures: [],
  },

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    { id: 'client', label: 'Client', role: 'Client', kind: 'client', x: 150, y: 230, description: '…' },
    {
      id: 'service',
      label: 'Service',
      role: 'Application service',
      kind: 'class',
      x: 600,
      y: 230,
      description: '…',
      patterns: ['repository'],
    },
  ],
  relations: [
    { id: 'call', from: 'client', to: 'service', type: 'calls', label: 'run()', description: '…', code: 'usage' },
  ],

  // Animated scenario
  steps: [
    {
      title: 'Client calls the service',
      description: '…',
      highlight: ['client', 'call', 'service'],
      packets: [{ relation: 'call', label: 'run()' }],
      notes: { service: 'running' },
      code: 'usage',
    },
  ],

  // Example code lives in example.ts / example.cs / example.py next to this file.
  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  // All three are required for real architectures (the persisted language tab needs them everywhere).
  code: tsExample,
  csharp: csExample,
  python: pyExample,

  // Optional: a custom scene. Create Visualization.tsx next to this file and set
  // Visualization: MyVisualization,
}
