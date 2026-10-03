using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// [usage]
string[] rawLines = { "SKU-1,2,9.99", "bad-line", "SKU-3,5,2.00", "SKU-4,1,19.99" };

Func<IEnumerable<string>, IEnumerable<string>> pipeline = Pipeline.Pipe(
    Pipeline.WithTrace<string, Candidate>("parse", Filters.ParseLines),
    Pipeline.WithTrace<Candidate, Line>("validate", Filters.ValidateLines),
    Pipeline.WithTrace<Line, Line>("total", Filters.AddLineTotal),
    Pipeline.WithTrace<Line, Line>("discount", Filters.ApplyDiscount),
    Pipeline.WithTrace<Line, Line>("tax", Filters.AddTax),
    Pipeline.WithTrace<Line, string>("format", Filters.FormatLines));

foreach (var line in pipeline(rawLines))
{
    Console.WriteLine(line);
}

// Swap the pipeline: drop ApplyDiscount entirely, re-run just the SKU-3 record, and
// nothing about ParseLines, ValidateLines, AddLineTotal, AddTax or FormatLines has to change.
Func<IEnumerable<string>, IEnumerable<string>> pipelineNoDiscount = Pipeline.Pipe<string, Candidate, Line, Line, Line, string>(
    Filters.ParseLines, Filters.ValidateLines, Filters.AddLineTotal, Filters.AddTax, Filters.FormatLines);

foreach (var line in pipelineNoDiscount(new[] { "SKU-3,5,2.00" }))
{
    Console.WriteLine("no-discount pipeline -> " + line);
}
// [/usage]

// [types]
/// <summary>What ParseLines produces: a raw line split into all of its comma-separated fields.</summary>
record Candidate(int LineNo, string Raw, IReadOnlyList<string> Fields);

/// <summary>
/// The record every later filter passes along. Rejected lines carry a reason and flow
/// through untouched; valid lines pick up more fields (LineTotalCents, DiscountCents,
/// TaxCents) as they move through the pipeline.
/// </summary>
record Line(
    int LineNo,
    string Raw,
    bool Rejected,
    string? Reason = null,
    string? Sku = null,
    int? Qty = null,
    int? UnitPriceCents = null,
    int? LineTotalCents = null,
    int? DiscountCents = null,
    int? TaxCents = null);

static class Money
{
    public static string CentsToDollars(int cents)
    {
        var sign = cents < 0 ? "-" : "";
        var abs = Math.Abs(cents);
        return $"{sign}${abs / 100}.{(abs % 100).ToString("D2", CultureInfo.InvariantCulture)}";
    }
}
// [/types]

// [pipe]
/// <summary>
/// A pipeline built from several filters has exactly the same shape as any one of them
/// (IEnumerable&lt;A&gt; in, IEnumerable&lt;B&gt; out) — that is what lets Pipe() nest
/// pipelines inside bigger pipelines like any other filter.
/// </summary>
static class Pipeline
{
    public static Func<IEnumerable<A>, IEnumerable<B>> Pipe<A, B>(Func<IEnumerable<A>, IEnumerable<B>> f1) => f1;

    public static Func<IEnumerable<A>, IEnumerable<C>> Pipe<A, B, C>(
        Func<IEnumerable<A>, IEnumerable<B>> f1, Func<IEnumerable<B>, IEnumerable<C>> f2) =>
        input => f2(f1(input));

    public static Func<IEnumerable<A>, IEnumerable<D>> Pipe<A, B, C, D>(
        Func<IEnumerable<A>, IEnumerable<B>> f1, Func<IEnumerable<B>, IEnumerable<C>> f2,
        Func<IEnumerable<C>, IEnumerable<D>> f3) =>
        input => f3(f2(f1(input)));

    public static Func<IEnumerable<A>, IEnumerable<E>> Pipe<A, B, C, D, E>(
        Func<IEnumerable<A>, IEnumerable<B>> f1, Func<IEnumerable<B>, IEnumerable<C>> f2,
        Func<IEnumerable<C>, IEnumerable<D>> f3, Func<IEnumerable<D>, IEnumerable<E>> f4) =>
        input => f4(f3(f2(f1(input))));

    public static Func<IEnumerable<A>, IEnumerable<F>> Pipe<A, B, C, D, E, F>(
        Func<IEnumerable<A>, IEnumerable<B>> f1, Func<IEnumerable<B>, IEnumerable<C>> f2,
        Func<IEnumerable<C>, IEnumerable<D>> f3, Func<IEnumerable<D>, IEnumerable<E>> f4,
        Func<IEnumerable<E>, IEnumerable<F>> f5) =>
        input => f5(f4(f3(f2(f1(input)))));

    public static Func<IEnumerable<A>, IEnumerable<G>> Pipe<A, B, C, D, E, F, G>(
        Func<IEnumerable<A>, IEnumerable<B>> f1, Func<IEnumerable<B>, IEnumerable<C>> f2,
        Func<IEnumerable<C>, IEnumerable<D>> f3, Func<IEnumerable<D>, IEnumerable<E>> f4,
        Func<IEnumerable<E>, IEnumerable<F>> f5, Func<IEnumerable<F>, IEnumerable<G>> f6) =>
        input => f6(f5(f4(f3(f2(f1(input))))));

    /// <summary>
    /// A decorator for iterators: wraps any stream in another stream with the exact same
    /// IEnumerable&lt;T&gt; interface, logging each element as it is pulled through. It adds
    /// behaviour (the trace) without the filters it wraps ever knowing it is there.
    /// </summary>
    static IEnumerable<T> Logged<T>(string label, IEnumerable<T> source)
    {
        var n = 0;
        foreach (var item in source)
        {
            n++;
            Console.WriteLine($"  [{label}] pulled #{n}");
            yield return item;
        }
    }

    public static Func<IEnumerable<A>, IEnumerable<B>> WithTrace<A, B>(string label, Func<IEnumerable<A>, IEnumerable<B>> filter) =>
        input => Logged(label, filter(input));
}
// [/pipe]

static class Filters
{
    static readonly System.Text.RegularExpressions.Regex SkuRe = new(@"^SKU-\d+$");
    static readonly System.Text.RegularExpressions.Regex QtyRe = new(@"^\d+$");
    // Exactly two decimal digits, so the cents can be read straight out of the string —
    // no floating-point multiplication (and its rounding surprises) anywhere near money.
    static readonly System.Text.RegularExpressions.Regex PriceRe = new(@"^\d+\.\d{2}$");

    // [parse]
    /// <summary>
    /// Pure filter: splits each raw line on commas. It never judges whether the result
    /// looks like a valid order line — that is ValidateLines's job, not ParseLines's.
    /// </summary>
    public static IEnumerable<Candidate> ParseLines(IEnumerable<string> lines)
    {
        var lineNo = 0;
        foreach (var raw in lines)
        {
            lineNo++;
            yield return new Candidate(lineNo, raw, raw.Split(',').Select(f => f.Trim()).ToList());
        }
    }
    // [/parse]

    // [validate]
    /// <summary>
    /// Pure filter: the one place that decides a line is bad. A candidate that fails any
    /// check becomes a rejected Line (reported, not thrown away) and still flows through
    /// every later filter unchanged; everything else becomes a valid Line with parsed
    /// numbers instead of text.
    /// </summary>
    public static IEnumerable<Line> ValidateLines(IEnumerable<Candidate> candidates)
    {
        foreach (var c in candidates)
        {
            if (c.Fields.Count != 3)
            {
                yield return new Line(c.LineNo, c.Raw, true, Reason: "expected sku,qty,price");
                continue;
            }

            var sku = c.Fields[0];
            var qtyText = c.Fields[1];
            var priceText = c.Fields[2];

            if (!SkuRe.IsMatch(sku))
            {
                yield return new Line(c.LineNo, c.Raw, true, Reason: $"invalid sku \"{sku}\"");
                continue;
            }
            if (!QtyRe.IsMatch(qtyText) || int.Parse(qtyText, CultureInfo.InvariantCulture) <= 0)
            {
                yield return new Line(c.LineNo, c.Raw, true, Reason: "quantity must be a positive integer");
                continue;
            }
            if (!PriceRe.IsMatch(priceText))
            {
                yield return new Line(c.LineNo, c.Raw, true, Reason: "price must look like 9.99");
                continue;
            }

            yield return new Line(
                c.LineNo, c.Raw, false,
                Sku: sku,
                Qty: int.Parse(qtyText, CultureInfo.InvariantCulture),
                UnitPriceCents: int.Parse(priceText.Replace(".", ""), CultureInfo.InvariantCulture));
        }
    }
    // [/validate]

    // [total]
    /// <summary>Pure filter: adds the line total, in integer cents. Rejected lines pass through untouched.</summary>
    public static IEnumerable<Line> AddLineTotal(IEnumerable<Line> lines)
    {
        foreach (var line in lines)
        {
            if (line.Rejected)
            {
                yield return line;
                continue;
            }
            yield return line with { LineTotalCents = line.Qty!.Value * line.UnitPriceCents!.Value };
        }
    }
    // [/total]

    // [discount]
    const int DiscountMinQty = 5;
    const double DiscountRate = 0.1;

    /// <summary>
    /// Pure filter, added to the pipeline after the other five already existed — a 10%
    /// discount for orders of 5 or more units. Nothing about ParseLines, ValidateLines,
    /// AddLineTotal, AddTax or FormatLines changed to make room for it; only the Pipe() call did.
    /// </summary>
    public static IEnumerable<Line> ApplyDiscount(IEnumerable<Line> lines)
    {
        foreach (var line in lines)
        {
            if (line.Rejected || line.Qty!.Value < DiscountMinQty)
            {
                yield return line;
                continue;
            }
            var discountCents = (int)Math.Round(line.LineTotalCents!.Value * DiscountRate, MidpointRounding.AwayFromZero);
            yield return line with { DiscountCents = discountCents };
        }
    }
    // [/discount]

    // [tax]
    const double TaxRate = 0.08;

    /// <summary>
    /// Pure filter: 8% tax on whatever the line's total currently is. Because this filter
    /// runs after ApplyDiscount in the Pipe() call below, it taxes the discounted amount —
    /// that is a property of the ordering, not of either filter's own code.
    /// </summary>
    public static IEnumerable<Line> AddTax(IEnumerable<Line> lines)
    {
        foreach (var line in lines)
        {
            if (line.Rejected)
            {
                yield return line;
                continue;
            }
            var netCents = line.LineTotalCents!.Value - (line.DiscountCents ?? 0);
            var taxCents = (int)Math.Round(netCents * TaxRate, MidpointRounding.AwayFromZero);
            yield return line with { TaxCents = taxCents };
        }
    }
    // [/tax]

    // [format]
    static string FormatLine(Line line)
    {
        if (line.Rejected)
        {
            return $"REJECTED line {line.LineNo}: \"{line.Raw}\" — {line.Reason}";
        }
        var netCents = line.LineTotalCents!.Value - (line.DiscountCents ?? 0);
        var finalCents = netCents + line.TaxCents!.Value;
        var discountPart = line.DiscountCents is { } d and not 0
            ? $" - discount {Money.CentsToDollars(d)} (net {Money.CentsToDollars(netCents)})"
            : "";
        return $"{line.Sku} x{line.Qty} @ {Money.CentsToDollars(line.UnitPriceCents!.Value)} = {Money.CentsToDollars(line.LineTotalCents!.Value)}" +
               $"{discountPart} + tax {Money.CentsToDollars(line.TaxCents!.Value)} = {Money.CentsToDollars(finalCents)}";
    }

    /// <summary>Pluggable, swappable filter: a different FormatLine would change only the output shape.</summary>
    public static IEnumerable<string> FormatLines(IEnumerable<Line> lines)
    {
        foreach (var line in lines) yield return FormatLine(line);
    }
    // [/format]
}
