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
    'You want subclasses to extend specific steps of a behavior while the overall algorithm stays fixed. (Enforcing "un-overridable" needs language support TypeScript lacks — Java\'s `final` or C#\'s non-virtual-by-default methods do this; here it\'s only a convention.)',
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
    'java.util.AbstractList, whose concrete iterator/indexOf methods are built from the abstract get() and size() primitives a subclass supplies',
    'java.io.InputStream.read(byte[], int, int) — the concrete multi-byte overload calls the abstract single-byte read() that subclasses must implement',
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
        'Declares generate() as the fixed template method, calling three kinds of step in order: fetchData() (concrete — implemented once here and inherited unchanged), formatData() (a hook with a default no-op implementation subclasses may override), and exportData() (abstract — every subclass must supply it).',
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
        'Overrides only the required exportData() step, to write CSV rows. It never overrides fetchData() or the formatData() hook, so both base-class implementations run exactly as inherited.',
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
        'Overrides the required exportData() step for PDF output, and additionally overrides the optional formatData() hook to compress whitespace that its raw data deliberately contains — something CsvReportGenerator does not need.',
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
      id: 'dispatch-csv-export',
      from: 'reportGenerator',
      to: 'csvReport',
      type: 'calls',
      label: 'exportData()',
      bend: -25,
      description:
        'exportData() is abstract on ReportGenerator, so the call dispatches straight to CsvReportGenerator’s override. fetchData() and formatData(), by contrast, are never dispatched here — CsvReportGenerator doesn’t override either.',
      code: 'csvExport',
    },
    {
      id: 'dispatch-pdf-hook',
      from: 'reportGenerator',
      to: 'pdfReport',
      type: 'calls',
      label: 'formatData(): compress',
      bend: -25,
      description: 'The skeleton calls the formatData() hook, which PdfReportGenerator overrides to compress whitespace before export.',
      code: 'pdfHook',
    },
    {
      id: 'dispatch-pdf-export',
      from: 'reportGenerator',
      to: 'pdfReport',
      type: 'calls',
      label: 'exportData()',
      bend: -10,
      description: 'exportData() resolves to PdfReportGenerator’s override instead, wrapping the now-clean rows in a PDF body.',
      code: 'pdfExport',
    },
  ],
  steps: [
    {
      title: 'One skeleton, three kinds of steps',
      description:
        'ReportGenerator fixes the order of generate() once and for all: fetch, format, export. fetchData() is concrete and shared by every subclass; formatData() is a hook with a default implementation subclasses may override; exportData() is abstract and every subclass must supply it.',
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
      title: 'Concrete step: fetchData()',
      description:
        'The skeleton calls this.fetchData() — a concrete method defined once on ReportGenerator and inherited unmodified by every subclass. For CsvReportGenerator it just returns the three clean CSV rows passed to the constructor.',
      highlight: ['reportGenerator'],
      notes: { reportGenerator: 'rows: 3' },
      code: 'fetch',
    },
    {
      title: 'Hook: formatData() — CSV uses the default',
      description:
        'The skeleton also calls formatData(), but CsvReportGenerator never overrode it — so the base class’s default implementation runs, passing the rows through unchanged.',
      highlight: ['reportGenerator'],
      notes: { reportGenerator: 'hook: default' },
      code: 'hook',
    },
    {
      title: 'Abstract step: exportData() dispatches to CsvReportGenerator',
      description:
        'exportData() has no implementation on ReportGenerator at all — it is abstract. The call dispatches straight to CsvReportGenerator’s override, which joins the rows into a CSV string that generate() hands back to the caller.',
      highlight: ['reportGenerator', 'dispatch-csv-export', 'csvReport'],
      packets: [{ relation: 'dispatch-csv-export', label: 'exportData()' }],
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
      title: 'Hook override: formatData() compresses whitespace',
      description:
        'generate() runs again, identical to before. This time formatData() resolves to PdfReportGenerator’s override, which compresses the deliberately messy whitespace in its raw data before exportData() writes the PDF body.',
      highlight: ['client', 'client-calls', 'reportGenerator', 'dispatch-pdf-hook', 'pdfReport'],
      packets: [
        { relation: 'client-calls', label: 'generate()' },
        { relation: 'dispatch-pdf-hook', label: 'formatData(): compress' },
      ],
      notes: { pdfReport: 'compressed' },
      code: 'pdfHook',
    },
    {
      title: 'Abstract step: exportData() dispatches to PdfReportGenerator',
      description: 'exportData() dispatches to PdfReportGenerator’s override instead, wrapping the now-clean rows in a PDF body.',
      highlight: ['reportGenerator', 'dispatch-pdf-export', 'pdfReport'],
      packets: [{ relation: 'dispatch-pdf-export', label: 'exportData()' }],
      notes: { pdfReport: 'exported' },
      code: 'pdfExport',
    },
  ],
  code: `
// [reportGenerator]
abstract class ReportGenerator {
  constructor(protected readonly records: string[]) {}

  // [generate]
  // The template method — fixed skeleton. By convention never overridden;
  // TypeScript has no \`final\` keyword to enforce that (Java's \`final\`, or
  // C#'s methods being non-virtual by default, would).
  generate(): string {
    const rows = this.fetchData()
    const formatted = this.formatData(rows)
    return this.exportData(formatted)
  }
  // [/generate]

  // [fetch]
  // Concrete step — implemented once here and inherited unmodified by
  // every subclass; nothing below overrides it.
  protected fetchData(): string[] {
    return [...this.records]
  }
  // [/fetch]

  // [hook]
  // Hook — an optional extension point; the default is a safe no-op.
  protected formatData(rows: string[]): string[] {
    return rows
  }
  // [/hook]

  // Abstract primitive operation — every subclass must supply its own export format.
  protected abstract exportData(rows: string[]): string
}
// [/reportGenerator]

// [csvReport]
class CsvReportGenerator extends ReportGenerator {
  constructor() {
    super(['id,name,total', '1,Widget,42.00', '2,Gadget,17.50'])
  }

  // fetchData() and formatData() are not overridden — both base-class
  // implementations above (one concrete, one a hook) run unchanged.

  // [csvExport]
  protected exportData(rows: string[]): string {
    return rows.join('\\n')
  }
  // [/csvExport]
}
// [/csvReport]

// [pdfReport]
class PdfReportGenerator extends ReportGenerator {
  constructor() {
    // Deliberately messy — the extra spaces are what formatData() below cleans up.
    super(['  Invoice   #1042  ', '  Total   due:    $59.50  '])
  }

  // [pdfHook]
  // Overrides the hook to compress whitespace before export.
  protected formatData(rows: string[]): string[] {
    return rows.map((r) => r.trim().replace(/\\s+/g, ' '))
  }
  // [/pdfHook]

  // [pdfExport]
  protected exportData(rows: string[]): string {
    return \`%PDF-1.4\\n\${rows.join('\\n')}\`
  }
  // [/pdfExport]
}
// [/pdfReport]

// Usage
// [usage]
const csv: ReportGenerator = new CsvReportGenerator()
csv.generate() // "id,name,total\\n1,Widget,42.00\\n2,Gadget,17.50"

const pdf: ReportGenerator = new PdfReportGenerator()
pdf.generate() // "%PDF-1.4\\nInvoice #1042\\nTotal due: $59.50"
// [/usage]
`,
  csharp: `
using System.Text.RegularExpressions;

// Usage
// [usage]
ReportGenerator csv = new CsvReportGenerator();
Console.WriteLine(csv.Generate()); // "id,name,total\\n1,Widget,42.00\\n2,Gadget,17.50"

ReportGenerator pdf = new PdfReportGenerator();
Console.WriteLine(pdf.Generate()); // "%PDF-1.4\\nInvoice #1042\\nTotal due: $59.50"
// [/usage]

// [reportGenerator]
abstract class ReportGenerator(IReadOnlyList<string> records)
{
    // [generate]
    // The template method — fixed skeleton. By convention never overridden;
    // C# methods are non-virtual by default, so a subclass literally cannot
    // override Generate() unless it is marked virtual — a guarantee
    // TypeScript has no way to enforce.
    public string Generate()
    {
        var rows = FetchData();
        var formatted = FormatData(rows);
        return ExportData(formatted);
    }
    // [/generate]

    // [fetch]
    // Concrete step — implemented once here and inherited unmodified by
    // every subclass; nothing below overrides it.
    protected virtual List<string> FetchData()
    {
        return [.. records];
    }
    // [/fetch]

    // [hook]
    // Hook — an optional extension point; the default is a safe no-op.
    protected virtual List<string> FormatData(List<string> rows)
    {
        return rows;
    }
    // [/hook]

    // Abstract primitive operation — every subclass must supply its own export format.
    protected abstract string ExportData(List<string> rows);
}
// [/reportGenerator]

// [csvReport]
class CsvReportGenerator() : ReportGenerator(["id,name,total", "1,Widget,42.00", "2,Gadget,17.50"])
{
    // FetchData() and FormatData() are not overridden — both base-class
    // implementations above (one concrete, one a hook) run unchanged.

    // [csvExport]
    protected override string ExportData(List<string> rows)
    {
        return string.Join("\\n", rows);
    }
    // [/csvExport]
}
// [/csvReport]

// [pdfReport]
// Deliberately messy construction — the extra spaces are what FormatData() below cleans up.
class PdfReportGenerator() : ReportGenerator(["  Invoice   #1042  ", "  Total   due:    $59.50  "])
{
    // [pdfHook]
    // Overrides the hook to compress whitespace before export.
    protected override List<string> FormatData(List<string> rows)
    {
        return rows.Select(r => Regex.Replace(r.Trim(), @"\\s+", " ")).ToList();
    }
    // [/pdfHook]

    // [pdfExport]
    protected override string ExportData(List<string> rows)
    {
        return $"%PDF-1.4\\n{string.Join("\\n", rows)}";
    }
    // [/pdfExport]
}
// [/pdfReport]
`,
}
