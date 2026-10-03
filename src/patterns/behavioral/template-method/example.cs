using System.Text.RegularExpressions;

// Usage
// [usage]
ReportGenerator csv = new CsvReportGenerator();
Console.WriteLine(csv.Generate()); // "id,name,total\n1,Widget,42.00\n2,Gadget,17.50"

ReportGenerator pdf = new PdfReportGenerator();
Console.WriteLine(pdf.Generate()); // "%PDF-1.4\nInvoice #1042\nTotal due: $59.50"
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
    protected List<string> FetchData()
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
        return string.Join("\n", rows);
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
        return rows.Select(r => Regex.Replace(r.Trim(), @"\s+", " ")).ToList();
    }
    // [/pdfHook]

    // [pdfExport]
    protected override string ExportData(List<string> rows)
    {
        return $"%PDF-1.4\n{string.Join("\n", rows)}";
    }
    // [/pdfExport]
}
// [/pdfReport]
