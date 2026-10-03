package main

import (
	"fmt"
	"iter"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// [types]
// Candidate is what parseLines produces: a raw line split into all of its
// comma-separated fields.
type Candidate struct {
	LineNo int
	Raw    string
	Fields []string
}

// Line is the record every later filter passes along. Rejected lines carry a reason and
// flow through untouched; valid lines pick up more fields (LineTotalCents, DiscountCents,
// TaxCents) as they move through the pipeline. Go has no optional ints, so a zero value
// means "not set yet" -- for DiscountCents that is also exactly "no discount".
type Line struct {
	LineNo         int
	Raw            string
	Rejected       bool
	Reason         string
	Sku            string
	Qty            int
	UnitPriceCents int
	LineTotalCents int
	DiscountCents  int
	TaxCents       int
}

var (
	skuRe = regexp.MustCompile(`^SKU-\d+$`)
	qtyRe = regexp.MustCompile(`^\d+$`)
	// Exactly two decimal digits, so the cents can be read straight out of the string --
	// no floating-point multiplication (and its rounding surprises) anywhere near money.
	priceRe = regexp.MustCompile(`^\d+\.\d{2}$`)
)

func centsToDollars(cents int) string {
	sign := ""
	if cents < 0 {
		sign = "-"
		cents = -cents
	}
	return fmt.Sprintf("%s$%d.%02d", sign, cents/100, cents%100)
}

// [/types]

// [pipe]
// Filter is one pipeline stage: a function from a stream of A to a stream of B.
// Go's iter.Seq is a lazy push iterator: the consumer's range loop starts it, and each
// stage pushes one element at a time to yield, so elements still flow through the stages
// one at a time, in the same order as in the other languages.
type Filter[A, B any] func(iter.Seq[A]) iter.Seq[B]

// Pipe2 chains two filters. A pipeline built from filters has exactly the same shape
// as any one of them (a stream in, a stream out) -- that is what lets pipelines nest
// inside bigger pipelines like any other filter. Go has no variadic generics, so
// longer pipelines are built by nesting Pipe2, as Pipe5 and Pipe6 do below.
func Pipe2[A, B, C any](f1 Filter[A, B], f2 Filter[B, C]) Filter[A, C] {
	return func(input iter.Seq[A]) iter.Seq[C] { return f2(f1(input)) }
}

func Pipe5[A, B, C, D, E, F any](f1 Filter[A, B], f2 Filter[B, C], f3 Filter[C, D], f4 Filter[D, E], f5 Filter[E, F]) Filter[A, F] {
	return Pipe2(f1, Pipe2(f2, Pipe2(f3, Pipe2(f4, f5))))
}

func Pipe6[A, B, C, D, E, F, G any](f1 Filter[A, B], f2 Filter[B, C], f3 Filter[C, D], f4 Filter[D, E], f5 Filter[E, F], f6 Filter[F, G]) Filter[A, G] {
	return Pipe2(f1, Pipe5(f2, f3, f4, f5, f6))
}

// logged is a decorator for streams: it wraps any stream in another stream with the
// exact same iter.Seq interface, logging each element as it is pulled through. It adds
// behaviour (the trace) without the filters it wraps ever knowing it is there.
func logged[T any](label string, source iter.Seq[T]) iter.Seq[T] {
	return func(yield func(T) bool) {
		n := 0
		for item := range source {
			n++
			fmt.Printf("  [%s] pulled #%d\n", label, n)
			if !yield(item) {
				return
			}
		}
	}
}

func withTrace[A, B any](label string, filter Filter[A, B]) Filter[A, B] {
	return func(input iter.Seq[A]) iter.Seq[B] { return logged(label, filter(input)) }
}

// [/pipe]

// [parse]
// parseLines is a pure filter: splits each raw line on commas. It never judges whether
// the result looks like a valid order line -- that is validateLines' job, not parseLines'.
func parseLines(lines iter.Seq[string]) iter.Seq[Candidate] {
	return func(yield func(Candidate) bool) {
		lineNo := 0
		for raw := range lines {
			lineNo++
			parts := strings.Split(raw, ",")
			fields := make([]string, len(parts))
			for i, p := range parts {
				fields[i] = strings.TrimSpace(p)
			}
			if !yield(Candidate{LineNo: lineNo, Raw: raw, Fields: fields}) {
				return
			}
		}
	}
}

// [/parse]

// [validate]
// validateLines is a pure filter: the one place that decides a line is bad. A candidate
// that fails any check becomes a rejected Line (reported, not thrown away) and still
// flows through every later filter unchanged; everything else becomes a valid Line with
// parsed numbers instead of text.
func validateLines(candidates iter.Seq[Candidate]) iter.Seq[Line] {
	reject := func(c Candidate, reason string) Line {
		return Line{LineNo: c.LineNo, Raw: c.Raw, Rejected: true, Reason: reason}
	}
	return func(yield func(Line) bool) {
		for c := range candidates {
			if len(c.Fields) != 3 {
				if !yield(reject(c, "expected sku,qty,price")) {
					return
				}
				continue
			}
			sku, qtyText, priceText := c.Fields[0], c.Fields[1], c.Fields[2]
			if !skuRe.MatchString(sku) {
				if !yield(reject(c, fmt.Sprintf("invalid sku \"%s\"", sku))) {
					return
				}
				continue
			}
			qty, qtyErr := strconv.Atoi(qtyText)
			if !qtyRe.MatchString(qtyText) || qtyErr != nil || qty <= 0 {
				if !yield(reject(c, "quantity must be a positive integer")) {
					return
				}
				continue
			}
			if !priceRe.MatchString(priceText) {
				if !yield(reject(c, "price must look like 9.99")) {
					return
				}
				continue
			}
			unitPriceCents, _ := strconv.Atoi(strings.Replace(priceText, ".", "", 1))
			if !yield(Line{LineNo: c.LineNo, Raw: c.Raw, Rejected: false, Sku: sku, Qty: qty, UnitPriceCents: unitPriceCents}) {
				return
			}
		}
	}
}

// [/validate]

// [total]
// addLineTotal is a pure filter: adds the line total, in integer cents. Rejected lines
// pass through untouched.
func addLineTotal(lines iter.Seq[Line]) iter.Seq[Line] {
	return func(yield func(Line) bool) {
		for line := range lines {
			if !line.Rejected {
				line.LineTotalCents = line.Qty * line.UnitPriceCents // line is a copy; the upstream value is untouched
			}
			if !yield(line) {
				return
			}
		}
	}
}

// [/total]

// [discount]
const (
	discountMinQty = 5
	discountRate   = 0.1
)

// applyDiscount is a pure filter, added to the pipeline after the other five already
// existed -- a 10% discount for orders of 5 or more units. Nothing about parseLines,
// validateLines, addLineTotal, addTax or formatLines changed to make room for it; only
// the pipeline construction did.
func applyDiscount(lines iter.Seq[Line]) iter.Seq[Line] {
	return func(yield func(Line) bool) {
		for line := range lines {
			if !line.Rejected && line.Qty >= discountMinQty {
				line.DiscountCents = int(math.Round(float64(line.LineTotalCents) * discountRate))
			}
			if !yield(line) {
				return
			}
		}
	}
}

// [/discount]

// [tax]
const taxRate = 0.08

// addTax is a pure filter: 8% tax on whatever the line's total currently is. Because
// this filter runs after applyDiscount in the pipeline below, it taxes the discounted
// amount -- that is a property of the ordering, not of either filter's own code.
func addTax(lines iter.Seq[Line]) iter.Seq[Line] {
	return func(yield func(Line) bool) {
		for line := range lines {
			if !line.Rejected {
				netCents := line.LineTotalCents - line.DiscountCents
				line.TaxCents = int(math.Round(float64(netCents) * taxRate))
			}
			if !yield(line) {
				return
			}
		}
	}
}

// [/tax]

// [format]
func formatLine(line Line) string {
	if line.Rejected {
		return fmt.Sprintf("REJECTED line %d: \"%s\" — %s", line.LineNo, line.Raw, line.Reason)
	}
	netCents := line.LineTotalCents - line.DiscountCents
	finalCents := netCents + line.TaxCents
	discountPart := ""
	if line.DiscountCents != 0 {
		discountPart = fmt.Sprintf(" - discount %s (net %s)", centsToDollars(line.DiscountCents), centsToDollars(netCents))
	}
	return fmt.Sprintf("%s x%d @ %s = %s", line.Sku, line.Qty, centsToDollars(line.UnitPriceCents), centsToDollars(line.LineTotalCents)) +
		fmt.Sprintf("%s + tax %s = %s", discountPart, centsToDollars(line.TaxCents), centsToDollars(finalCents))
}

// formatLines is a pluggable, swappable filter: a different formatLine would change
// only the output shape.
func formatLines(lines iter.Seq[Line]) iter.Seq[string] {
	return func(yield func(string) bool) {
		for line := range lines {
			if !yield(formatLine(line)) {
				return
			}
		}
	}
}

// [/format]

// [usage]
func main() {
	rawLines := func(yield func(string) bool) {
		for _, raw := range []string{"SKU-1,2,9.99", "bad-line", "SKU-3,5,2.00", "SKU-4,1,19.99"} {
			if !yield(raw) {
				return
			}
		}
	}

	pipeline := Pipe6(
		withTrace("parse", parseLines),
		withTrace("validate", validateLines),
		withTrace("total", addLineTotal),
		withTrace("discount", applyDiscount),
		withTrace("tax", addTax),
		withTrace("format", formatLines),
	)

	for line := range pipeline(rawLines) {
		fmt.Println(line)
	}

	// Swap the pipeline: drop applyDiscount entirely, re-run just the SKU-3 record, and
	// nothing about parseLines, validateLines, addLineTotal, addTax or formatLines has to change.
	pipelineNoDiscount := Pipe5(parseLines, validateLines, addLineTotal, addTax, formatLines)
	only := func(yield func(string) bool) { yield("SKU-3,5,2.00") }
	for line := range pipelineNoDiscount(only) {
		fmt.Println("no-discount pipeline ->", line)
	}
}

// [/usage]
