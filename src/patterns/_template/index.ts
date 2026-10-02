/**
 * TEMPLATE — copy this folder to `src/patterns/<your-slug>/` and fill it in.
 * Folders starting with "_" are ignored by the registry, so this file never shows up on the site.
 * See README.md → "Adding a pattern" for details.
 */
import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'my-pattern', // must match the folder name; used in the URL (#/patterns/my-pattern)
  name: 'My Pattern',
  category: 'behavioral', // 'creational' | 'structural' | 'behavioral' | 'architectural'
  order: 99, // position within the category
  summary: 'One line shown on cards and in search.',
  intent: 'The GoF-style intent statement.',
  problem: 'What goes wrong without the pattern?',
  solution: 'How the pattern solves it.',
  analogy: 'A real-world analogy.',
  whenToUse: ['…'],
  pros: ['…'],
  cons: ['…'],
  realWorld: ['…'],
  related: [], // slugs of other patterns

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    { id: 'client', label: 'Client', role: 'Client', kind: 'client', x: 150, y: 230, description: '…' },
    { id: 'service', label: 'Service', role: 'Receiver', kind: 'class', x: 600, y: 230, description: '…' },
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

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: `
// [service]
class Service {
  run() {}
}
// [/service]

// [usage]
// [client]
new Service().run()
// [/client]
// [/usage]
`,

  // Optional: a C# example shown as a second tab next to TypeScript. Must use
  // the SAME region ids as `code` above (`npm test` checks this).
  // NOTE: C# top-level statements must appear before any type declarations
  // in the file, so usage code goes FIRST here even though TS puts it last.
  // csharp: `
  // // [usage]
  // // [client]
  // new Service().Run();
  // // [/client]
  // // [/usage]
  //
  // // [service]
  // class Service
  // {
  //     public void Run() { }
  // }
  // // [/service]
  // `,

  // Optional: a custom scene. Create Visualization.tsx next to this file and set
  // Visualization: MyVisualization,
}
