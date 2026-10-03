package main

import (
	"fmt"
)

// Shared types used by both versions below.
type ReportData struct {
	Rows []any
}

type Report struct {
	Warnings []string
}

func buildReport(data ReportData) Report {
	if len(data.Rows) > 2 {
		return Report{Warnings: []string{"low confidence"}}
	}
	return Report{Warnings: []string{}}
}

var cleanData = ReportData{Rows: []any{1, 2}}
var dataWithWarnings = ReportData{Rows: []any{1, 2, 3}}

// ============================================================
// Before: "no logger" is represented by nil.
// ============================================================
// [before]
// Named LegacyLogger only because Go has one namespace per package and the
// "after" version below declares Logger itself.
type LegacyLogger interface {
	Info(msg string)
	Warn(msg string)
	Error(msg string)
}

type ReportGeneratorBefore struct {
	logger LegacyLogger
}

func (g *ReportGeneratorBefore) Generate(data ReportData) Report {
	// [guard]
	if g.logger != nil {
		g.logger.Info("starting report")
	}
	result := buildReport(data)
	if g.logger != nil {
		g.logger.Info("report ready")
	}
	// [/guard]

	// [forgotten]
	if len(result.Warnings) > 0 {
		// forgot the nil check every other call site remembered. Go compiles
		// this without complaint (it has no nullable types for the compiler
		// to check), and it panics at runtime. Every call site needs its own
		// guard — exactly the clutter Null Object removes.
		g.logger.Warn(fmt.Sprintf("report has %d warnings", len(result.Warnings)))
	}
	// [/forgotten]

	return result
}

// crashes runs Generate and prints the panic, as the other languages print the caught exception.
func crashes(data ReportData) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("crashed: nil logger call")
		}
	}()
	(&ReportGeneratorBefore{logger: nil}).Generate(data)
}

// init runs before main, so this demo prints first, as it does at module level in the other languages.
func init() {
	// Fine on the happy path — the guarded calls just no-op:
	(&ReportGeneratorBefore{logger: nil}).Generate(cleanData)

	// Crashes the moment a report has warnings:
	crashes(dataWithWarnings)
	// crashed: nil logger call
}

// [/before]

// ============================================================
// After: a Null Object stands in for "no logger".
// ============================================================
// [logger]
type Logger interface {
	Info(msg string)
	Warn(msg string)
	Error(msg string)
}

// [/logger]

// [nullLogger]
type NullLogger struct{}

func (NullLogger) Info(msg string)  {}
func (NullLogger) Warn(msg string)  {}
func (NullLogger) Error(msg string) {}

// [/nullLogger]

// [consoleLogger]
type ConsoleLogger struct{}

func (ConsoleLogger) Info(msg string)  { fmt.Println(msg) }
func (ConsoleLogger) Warn(msg string)  { fmt.Println(msg) }
func (ConsoleLogger) Error(msg string) { fmt.Println(msg) }

// [/consoleLogger]

// [reportGenerator]
type ReportGenerator struct {
	logger Logger
}

// [holds]
// Go has no default arguments, so the constructor substitutes the Null Object
// when the caller passes nil (a plain nil interface, not a typed nil pointer).
func NewReportGenerator(logger Logger) *ReportGenerator {
	if logger == nil {
		logger = NullLogger{}
	}
	return &ReportGenerator{logger: logger}
}

// [/holds]

// [generate]
func (g *ReportGenerator) Generate(data ReportData) Report {
	g.logger.Info("starting report")
	result := buildReport(data)
	g.logger.Info("report ready")
	if len(result.Warnings) > 0 {
		g.logger.Warn(fmt.Sprintf("report has %d warnings", len(result.Warnings)))
	}
	return result
}

// [/generate]

// [/reportGenerator]

// [client]
func main() {
	quiet := NewReportGenerator(nil) // no logger passed — defaults to NullLogger
	quiet.Generate(dataWithWarnings) // runs to completion: no guard, no crash, no noise

	verbose := NewReportGenerator(ConsoleLogger{})
	verbose.Generate(dataWithWarnings) // the exact same Generate() — now it actually logs
}

// [/client]
