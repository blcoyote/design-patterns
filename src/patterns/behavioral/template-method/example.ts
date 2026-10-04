// [reportGenerator]
abstract class ReportGenerator {
  constructor(protected readonly records: string[]) {}

  // [generate]
  // The template method — fixed skeleton. By convention never overridden;
  // TypeScript has no `final` keyword to enforce that (Java's `final`, or
  // C#'s methods being non-virtual by default, would).
  generate(): string {
    const rows = this.fetchData();
    const formatted = this.formatData(rows);
    return this.exportData(formatted);
  }
  // [/generate]

  // [fetch]
  // Concrete step — implemented once here and inherited unmodified by
  // every subclass; nothing below overrides it.
  protected fetchData(): string[] {
    return [...this.records];
  }
  // [/fetch]

  // [hook]
  // Hook — an optional extension point; the default is a safe no-op.
  protected formatData(rows: string[]): string[] {
    return rows;
  }
  // [/hook]

  // Abstract primitive operation — every subclass must supply its own export format.
  protected abstract exportData(rows: string[]): string;
}
// [/reportGenerator]

// [csvReport]
class CsvReportGenerator extends ReportGenerator {
  constructor() {
    super(["id,name,total", "1,Widget,42.00", "2,Gadget,17.50"]);
  }

  // fetchData() and formatData() are not overridden — both base-class
  // implementations above (one concrete, one a hook) run unchanged.

  // [csvExport]
  protected exportData(rows: string[]): string {
    return rows.join("\n");
  }
  // [/csvExport]
}
// [/csvReport]

// [pdfReport]
class PdfReportGenerator extends ReportGenerator {
  constructor() {
    // Deliberately messy — the extra spaces are what formatData() below cleans up.
    super(["  Invoice   #1042  ", "  Total   due:    $59.50  "]);
  }

  // [pdfHook]
  // Overrides the hook to compress whitespace before export.
  protected formatData(rows: string[]): string[] {
    return rows.map((r) => r.trim().replace(/\s+/g, " "));
  }
  // [/pdfHook]

  // [pdfExport]
  protected exportData(rows: string[]): string {
    return `%PDF-1.4\n${rows.join("\n")}`;
  }
  // [/pdfExport]
}
// [/pdfReport]

// Usage
// [usage]
const csv: ReportGenerator = new CsvReportGenerator();
console.log(csv.generate()); // "id,name,total\n1,Widget,42.00\n2,Gadget,17.50"

const pdf: ReportGenerator = new PdfReportGenerator();
console.log(pdf.generate()); // "%PDF-1.4\nInvoice #1042\nTotal due: $59.50"
// [/usage]
