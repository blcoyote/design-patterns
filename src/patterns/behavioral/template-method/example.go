package main

import (
	"regexp"
	"strings"
)

// Go has no class inheritance or virtual dispatch through embedding: an embedded
// type's methods call the embedded type's own methods, never the outer type's.
// So the skeleton lives on ReportGenerator and calls the variable steps through
// the reportSteps interface that each concrete generator supplies.

// [reportGenerator]
// reportSteps are the steps a concrete generator may vary.
type reportSteps interface {
	FormatData(rows []string) []string // hook
	ExportData(rows []string) string   // abstract primitive operation
}

type ReportGenerator struct {
	records []string
	steps   reportSteps
}

// [generate]
// The template method — fixed skeleton. Go has no method overriding, so a
// concrete generator cannot replace Generate(); it can only supply the steps.
func (g *ReportGenerator) Generate() string {
	rows := g.fetchData()
	formatted := g.steps.FormatData(rows)
	return g.steps.ExportData(formatted)
}

// [/generate]

// [fetch]
// Concrete step — implemented once here and shared unmodified by
// every generator; nothing below replaces it.
func (g *ReportGenerator) fetchData() []string {
	return append([]string(nil), g.records...)
}

// [/fetch]

// [hook]
// Hook — an optional extension point; this default is a safe no-op.
// Generators embed DefaultHooks to inherit it, or define their own FormatData.
type DefaultHooks struct{}

func (DefaultHooks) FormatData(rows []string) []string {
	return rows
}

// [/hook]

// Abstract primitive operation — ExportData in reportSteps has no default,
// so every concrete generator must supply its own export format.
// [/reportGenerator]

// [csvReport]
type CsvReportGenerator struct {
	DefaultHooks
}

func NewCsvReportGenerator() *ReportGenerator {
	return &ReportGenerator{
		records: []string{"id,name,total", "1,Widget,42.00", "2,Gadget,17.50"},
		steps:   CsvReportGenerator{},
	}
}

// fetchData and FormatData are not replaced — the base fetch step and the
// embedded default hook (a no-op) run unchanged.

// [csvExport]
func (CsvReportGenerator) ExportData(rows []string) string {
	return strings.Join(rows, "\n")
}

// [/csvExport]
// [/csvReport]

// [pdfReport]
type PdfReportGenerator struct{}

func NewPdfReportGenerator() *ReportGenerator {
	return &ReportGenerator{
		// Deliberately messy — the extra spaces are what FormatData() below cleans up.
		records: []string{"  Invoice   #1042  ", "  Total   due:    $59.50  "},
		steps:   PdfReportGenerator{},
	}
}

var whitespace = regexp.MustCompile(`\s+`)

// [pdfHook]
// Supplies its own FormatData to compress whitespace before export.
func (PdfReportGenerator) FormatData(rows []string) []string {
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = whitespace.ReplaceAllString(strings.TrimSpace(r), " ")
	}
	return out
}

// [/pdfHook]

// [pdfExport]
func (PdfReportGenerator) ExportData(rows []string) string {
	return "%PDF-1.4\n" + strings.Join(rows, "\n")
}

// [/pdfExport]
// [/pdfReport]

// [usage]
func main() {
	csv := NewCsvReportGenerator()
	csv.Generate() // "id,name,total\n1,Widget,42.00\n2,Gadget,17.50"

	pdf := NewPdfReportGenerator()
	pdf.Generate() // "%PDF-1.4\nInvoice #1042\nTotal due: $59.50"
}

// [/usage]
