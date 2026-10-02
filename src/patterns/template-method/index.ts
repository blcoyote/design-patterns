import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'template-method',
  name: 'Template Method',
  category: 'behavioral',
  order: 6,
  summary: 'Fix the skeleton of an algorithm in a base class, and let subclasses override individual steps.',
  intent:
    'Define the skeleton of an algorithm in a base class method, deferring some of its steps to subclasses. Template Method lets subclasses redefine certain steps of an algorithm without changing its overall structure.',
  problem:
    'Two report exporters — CSV and PDF — follow almost the same procedure: fetch the data, format it, then write it out. Without a shared skeleton, every new format copies the same three-step sequence and only tweaks a line or two, so a bug in the ordering, or a forgotten step, has to be fixed in every copy separately.',
  solution:
    'Pull the invariant steps into one base-class method — generate() — and never let subclasses touch its order. Steps that must vary are declared abstract, forcing every subclass to supply them. Steps that usually do not vary, but occasionally might, are given a default implementation as an overridable hook. Each subclass then only writes the handful of lines that are genuinely different.',
  analogy:
    'A recipe card printed once and reused by every cook: preheat, mix, bake, cool. The steps and their order never change, but each cook can swap in their own mixing technique, or skip the optional glaze step entirely, while the structure of the recipe itself stays exactly as printed.',
  whenToUse: [
    'Several classes implement the same algorithm but differ in only a few steps, and that duplication needs to live in one place.',
    'You want subclasses to extend specific steps of a behavior while keeping the overall algorithm fixed and un-overridable.',
    'You want optional extension points (hooks) that most subclasses can safely ignore.',
  ],
  pros: [
    'Eliminates duplicated algorithm structure — the skeleton lives in exactly one place.',
    'Hooks give subclasses optional extension points without forcing every one of them to override everything.',
    'Calling code only ever depends on the base class, so new variants are added by adding a subclass.',
  ],
  cons: [
    'Inheritance ties a subclass to the base class for life — unlike Strategy’s composition, the algorithm cannot be swapped on an existing object at runtime.',
    'Deep or wide class hierarchies make it harder to see at a glance which subclass overrides which step.',
    'Subclasses can violate the skeleton’s assumptions in ways it never anticipated, which is easy to miss until it breaks.',
  ],
  realWorld: [
    'React class component lifecycle (componentDidMount, render, componentDidUpdate) invoked by the framework in a fixed order',
    'java.io.InputStream.read() delegating to an abstract single-byte read() that subclasses implement',
    'Test framework base classes that call setUp(), the test body, then tearDown() in a fixed sequence',
    'Abstract HTTP controller base classes that fix request validation and logging, leaving handle() to subclasses',
  ],
  related: ['strategy', 'factory-method', 'iterator'],
  participants: [
    {
      id: 'reportGenerator',
      label: 'ReportGenerator',
      role: 'Abstract Class (template)',
      kind: 'abstract',
      x: 400,
      y: 90,
      width: 260,
      description:
        'Declares generate() as the fixed template method: it calls fetchData() and exportData() (abstract — every subclass must override them) and formatData() (a hook with a default no-op implementation subclasses may override). The order never changes.',
    },
    {
      id: 'csvReport',
      label: 'CsvReportGenerator',
      role: 'Concrete Class',
      kind: 'class',
      x: 400,
      y: 260,
      width: 190,
      description:
        'Overrides the two required steps to read and write CSV rows. It never overrides the formatData() hook, so the base class’s default — pass the rows through unchanged — runs as-is.',
    },
    {
      id: 'pdfReport',
      label: 'PdfReportGenerator',
      role: 'Concrete Class (overrides hook)',
      kind: 'class',
      x: 650,
      y: 260,
      width: 190,
      description:
        'Overrides the two required steps for PDF output, and additionally overrides the optional formatData() hook to compress whitespace before export — something CsvReportGenerator does not need.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 150,
      y: 260,
      width: 120,
      description:
        'Creates a concrete report generator and calls generate() through the abstract ReportGenerator type, without knowing — or needing to know — which steps were overridden underneath.',
    },
  ],
  relations: [
    {
      id: 'csv-extends',
      from: 'csvReport',
      to: 'reportGenerator',
      type: 'implements',
      label: 'extends',
      bend: 25,
      description: 'CsvReportGenerator extends ReportGenerator, inheriting the fixed generate() skeleton and supplying its own fetchData()/exportData().',
      code: 'csvReport',
    },
    {
      id: 'pdf-extends',
      from: 'pdfReport',
      to: 'reportGenerator',
      type: 'implements',
      label: 'extends',
      bend: 25,
      description: 'PdfReportGenerator extends ReportGenerator the same way, additionally overriding the optional formatData() hook.',
      code: 'pdfReport',
    },
    {
      id: 'client-creates-csv',
      from: 'client',
      to: 'csvReport',
      type: 'creates',
      label: 'new CsvReportGenerator()',
      description: 'The client instantiates a CsvReportGenerator, but stores the result only as a ReportGenerator.',
      code: 'usage',
    },
    {
      id: 'client-creates-pdf',
      from: 'client',
      to: 'pdfReport',
      type: 'creates',
      label: 'new PdfReportGenerator()',
      bend: 90,
      description: 'The client instantiates a PdfReportGenerator instead — the same generate() call will now run different steps underneath.',
      code: 'usage',
    },
    {
      id: 'client-calls',
      from: 'client',
      to: 'reportGenerator',
      type: 'calls',
      label: 'generate()',
      bend: -20,
      description: 'The client calls generate() on the abstract ReportGenerator type. It has no idea which concrete steps will run underneath.',
      code: 'generate',
    },
    {
      id: 'dispatch-csv',
      from: 'reportGenerator',
      to: 'csvReport',
      type: 'calls',
      label: 'fetchData() / exportData()',
      bend: -25,
      description: 'Inside generate(), the inherited skeleton calls fetchData() and exportData(), which resolve polymorphically to CsvReportGenerator’s overrides.',
      code: 'csvFetch',
    },
    {
      id: 'dispatch-pdf',
      from: 'reportGenerator',
      to: 'pdfReport',
      type: 'calls',
      label: 'fetchData() / formatData() / exportData()',
      bend: -25,
      description: 'The same skeleton calls into PdfReportGenerator’s overrides instead — including its overridden formatData() hook.',
      code: 'pdfHook',
    },
  ],
  steps: [
    {
      title: 'One skeleton, two kinds of steps',
      description:
        'ReportGenerator fixes the order of generate() once and for all: fetch, format, export. fetchData() and exportData() are abstract and must be overridden; formatData() is a hook with a default implementation that subclasses may override if they need to.',
      highlight: ['reportGenerator', 'csv-extends', 'csvReport', 'pdf-extends', 'pdfReport'],
      code: 'reportGenerator',
    },
    {
      title: 'Client builds a CSV generator',
      description: 'The client instantiates a CsvReportGenerator, but stores it only as a ReportGenerator.',
      highlight: ['client', 'client-creates-csv', 'csvReport'],
      packets: [{ relation: 'client-creates-csv', label: 'new CsvReportGenerator()' }],
      notes: { csvReport: 'created' },
      code: 'usage',
    },
    {
      title: 'generate() runs — inherited, not overridden',
      description: 'Calling generate() runs the exact method defined on ReportGenerator; CsvReportGenerator never redefines it. The skeleton is now in control.',
      highlight: ['client', 'client-calls', 'reportGenerator'],
      packets: [{ relation: 'client-calls', label: 'generate()' }],
      notes: { reportGenerator: 'running' },
      code: 'generate',
    },
    {
      title: 'Required step: fetchData()',
      description: 'The skeleton calls this.fetchData(), which resolves to CsvReportGenerator’s override and returns three rows of CSV data.',
      highlight: ['reportGenerator', 'dispatch-csv', 'csvReport'],
      packets: [{ relation: 'dispatch-csv', label: 'fetchData()' }],
      notes: { csvReport: 'rows: 3' },
      code: 'csvFetch',
    },
    {
      title: 'Optional hook: formatData()',
      description:
        'The skeleton also calls formatData(), but CsvReportGenerator never overrode it — so the base class’s default implementation runs, passing the rows through unchanged.',
      highlight: ['reportGenerator'],
      notes: { reportGenerator: 'hook: default' },
      code: 'hook',
    },
    {
      title: 'Required step: exportData() returns',
      description: 'exportData() resolves to CsvReportGenerator’s override, joining the rows into a CSV string that generate() hands back to the caller.',
      highlight: ['reportGenerator', 'dispatch-csv', 'csvReport'],
      packets: [{ relation: 'dispatch-csv', label: 'csv text', reverse: true }],
      notes: { csvReport: 'exported' },
      code: 'csvExport',
    },
    {
      title: 'Swap in PdfReportGenerator',
      description: 'The client builds a different subclass instead. ReportGenerator’s generate() method does not change at all — only the steps it dispatches to do.',
      highlight: ['client', 'client-creates-pdf', 'pdfReport'],
      packets: [{ relation: 'client-creates-pdf', label: 'new PdfReportGenerator()' }],
      notes: { pdfReport: 'created' },
      code: 'pdfReport',
    },
    {
      title: 'Same call, the hook changes the outcome',
      description:
        'generate() runs again, identical to before, but this time formatData() resolves to PdfReportGenerator’s override and compresses whitespace before exportData() writes the PDF body.',
      highlight: ['client', 'client-calls', 'reportGenerator', 'dispatch-pdf', 'pdfReport'],
      packets: [
        { relation: 'client-calls', label: 'generate()' },
        { relation: 'dispatch-pdf', label: 'formatData(): compress' },
      ],
      notes: { pdfReport: 'compressed' },
      code: 'pdfHook',
    },
  ],
  code: `
// [reportGenerator]
abstract class ReportGenerator {
  // [generate]
  // The template method — fixed skeleton, never overridden.
  generate(): string {
    const rows = this.fetchData()
    const formatted = this.formatData(rows)
    return this.exportData(formatted)
  }
  // [/generate]

  // Required step — every subclass must supply its own data source.
  protected abstract fetchData(): string[]

  // [hook]
  // Optional hook — subclasses may override it; the default is a safe no-op.
  protected formatData(rows: string[]): string[] {
    return rows
  }
  // [/hook]

  // Required step — every subclass must supply its own export format.
  protected abstract exportData(rows: string[]): string
}
// [/reportGenerator]

// [csvReport]
class CsvReportGenerator extends ReportGenerator {
  // [csvFetch]
  protected fetchData(): string[] {
    return ['id,name,total', '1,Widget,42.00', '2,Gadget,17.50']
  }
  // [/csvFetch]

  // formatData() is not overridden — the hook's default above runs unchanged.

  // [csvExport]
  protected exportData(rows: string[]): string {
    return rows.join('\\n')
  }
  // [/csvExport]
}
// [/csvReport]

// [pdfReport]
class PdfReportGenerator extends ReportGenerator {
  protected fetchData(): string[] {
    return ['Invoice #1042', 'Total due: $59.50']
  }

  // [pdfHook]
  // Overrides the hook to compress whitespace before export.
  protected formatData(rows: string[]): string[] {
    return rows.map((r) => r.trim().replace(/\\s+/g, ' '))
  }
  // [/pdfHook]

  protected exportData(rows: string[]): string {
    return \`%PDF-1.4\\n\${rows.join('\\n')}\`
  }
}
// [/pdfReport]

// Usage
// [usage]
const csv: ReportGenerator = new CsvReportGenerator()
csv.generate() // "id,name,total\\n1,Widget,42.00\\n2,Gadget,17.50"

const pdf: ReportGenerator = new PdfReportGenerator()
pdf.generate() // "%PDF-1.4\\nInvoice #1042 Total due: $59.50"
// [/usage]
`,
}
