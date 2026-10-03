from __future__ import annotations

import re
from dataclasses import dataclass, replace
from typing import Callable, Iterable, Iterator, Optional, TypeVar

A = TypeVar("A")
B = TypeVar("B")
C = TypeVar("C")
D = TypeVar("D")
E = TypeVar("E")
F = TypeVar("F")
G = TypeVar("G")


# [types]
@dataclass(frozen=True)
class Candidate:
    """What parse_lines() produces: a raw line split into all of its comma-separated fields."""

    line_no: int
    raw: str
    fields: tuple[str, ...]


@dataclass(frozen=True)
class Line:
    """The record every later filter passes along. Rejected lines carry a reason and flow
    through untouched; valid lines pick up more fields (line_total_cents, discount_cents,
    tax_cents) as they move through the pipeline."""

    line_no: int
    raw: str
    rejected: bool
    reason: Optional[str] = None
    sku: Optional[str] = None
    qty: Optional[int] = None
    unit_price_cents: Optional[int] = None
    line_total_cents: Optional[int] = None
    discount_cents: Optional[int] = None
    tax_cents: Optional[int] = None


SKU_RE = re.compile(r"^SKU-\d+$")
QTY_RE = re.compile(r"^\d+$")
# Exactly two decimal digits, so the cents can be read straight out of the string —
# no floating-point multiplication (and its rounding surprises) anywhere near money.
PRICE_RE = re.compile(r"^\d+\.\d{2}$")


def cents_to_dollars(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    return f"{sign}${cents // 100}.{cents % 100:02d}"


def round_half_away_from_zero(value: float) -> int:
    """All amounts here are non-negative, so floor(x + 0.5) matches the AwayFromZero
    rounding used on the C# side — Python's own round() rounds half-to-even instead."""
    import math

    return int(math.floor(value + 0.5))


# [/types]


# [pipe]
Filter = Callable[[Iterable[A]], Iterable[B]]


def pipe(*fns: Filter) -> Filter:
    """A pipeline built from several filters has exactly the same shape as any one of
    them (an iterable in, an iterable out) — that is what lets pipe() nest pipelines
    inside bigger pipelines like any other filter."""

    def run(source: Iterable) -> Iterable:
        acc: Iterable = source
        for fn in fns:
            acc = fn(acc)
        return acc

    return run


def logged(label: str, source: Iterable[A]) -> Iterator[A]:
    """A decorator for iterators: wraps any stream in another stream with the exact same
    iterable interface, logging each element as it is pulled through. It adds behaviour
    (the trace) without the filters it wraps ever knowing it is there."""
    n = 0
    for item in source:
        n += 1
        print(f"  [{label}] pulled #{n}")
        yield item


def with_trace(label: str, filter_fn: Filter) -> Filter:
    return lambda source: logged(label, filter_fn(source))


# [/pipe]


# [parse]
def parse_lines(lines: Iterable[str]) -> Iterator[Candidate]:
    """Pure filter: splits each raw line on commas. It never judges whether the result
    looks like a valid order line — that is validate_lines()'s job, not parse_lines()'s."""
    line_no = 0
    for raw in lines:
        line_no += 1
        yield Candidate(line_no, raw, tuple(f.strip() for f in raw.split(",")))


# [/parse]


# [validate]
def validate_lines(candidates: Iterable[Candidate]) -> Iterator[Line]:
    """Pure filter: the one place that decides a line is bad. A candidate that fails any
    check becomes a rejected Line (reported, not thrown away) and still flows through
    every later filter unchanged; everything else becomes a valid Line with parsed
    numbers instead of text."""
    for c in candidates:
        if len(c.fields) != 3:
            yield Line(c.line_no, c.raw, rejected=True, reason="expected sku,qty,price")
            continue

        sku, qty_text, price_text = c.fields

        if not SKU_RE.match(sku):
            yield Line(c.line_no, c.raw, rejected=True, reason=f'invalid sku "{sku}"')
            continue
        if not QTY_RE.match(qty_text) or int(qty_text) <= 0:
            yield Line(c.line_no, c.raw, rejected=True, reason="quantity must be a positive integer")
            continue
        if not PRICE_RE.match(price_text):
            yield Line(c.line_no, c.raw, rejected=True, reason="price must look like 9.99")
            continue

        yield Line(
            c.line_no,
            c.raw,
            rejected=False,
            sku=sku,
            qty=int(qty_text),
            unit_price_cents=int(price_text.replace(".", "")),
        )


# [/validate]


# [total]
def add_line_total(lines: Iterable[Line]) -> Iterator[Line]:
    """Pure filter: adds the line total, in integer cents. Rejected lines pass through untouched."""
    for line in lines:
        if line.rejected:
            yield line
            continue
        yield replace(line, line_total_cents=line.qty * line.unit_price_cents)


# [/total]


# [discount]
DISCOUNT_MIN_QTY = 5
DISCOUNT_RATE = 0.1


def apply_discount(lines: Iterable[Line]) -> Iterator[Line]:
    """Pure filter, added to the pipeline after the other five already existed — a 10%
    discount for orders of 5 or more units. Nothing about parse_lines, validate_lines,
    add_line_total, add_tax or format_lines changed to make room for it; only the pipe() call did."""
    for line in lines:
        if line.rejected or line.qty < DISCOUNT_MIN_QTY:
            yield line
            continue
        discount_cents = round_half_away_from_zero(line.line_total_cents * DISCOUNT_RATE)
        yield replace(line, discount_cents=discount_cents)


# [/discount]


# [tax]
TAX_RATE = 0.08


def add_tax(lines: Iterable[Line]) -> Iterator[Line]:
    """Pure filter: 8% tax on whatever the line's total currently is. Because this filter
    runs after apply_discount in the pipe() call below, it taxes the discounted amount —
    that is a property of the ordering, not of either filter's own code."""
    for line in lines:
        if line.rejected:
            yield line
            continue
        net_cents = line.line_total_cents - (line.discount_cents or 0)
        yield replace(line, tax_cents=round_half_away_from_zero(net_cents * TAX_RATE))


# [/tax]


# [format]
def format_line(line: Line) -> str:
    if line.rejected:
        return f'REJECTED line {line.line_no}: "{line.raw}" — {line.reason}'

    net_cents = line.line_total_cents - (line.discount_cents or 0)
    final_cents = net_cents + line.tax_cents
    discount_part = (
        f" - discount {cents_to_dollars(line.discount_cents)} (net {cents_to_dollars(net_cents)})"
        if line.discount_cents
        else ""
    )
    return (
        f"{line.sku} x{line.qty} @ {cents_to_dollars(line.unit_price_cents)} = {cents_to_dollars(line.line_total_cents)}"
        f"{discount_part} + tax {cents_to_dollars(line.tax_cents)} = {cents_to_dollars(final_cents)}"
    )


def format_lines(lines: Iterable[Line]) -> Iterator[str]:
    """Pluggable, swappable filter: a different format_line would change only the output shape."""
    for line in lines:
        yield format_line(line)


# [/format]


# [usage]
RAW_LINES = ["SKU-1,2,9.99", "bad-line", "SKU-3,5,2.00", "SKU-4,1,19.99"]

pipeline = pipe(
    with_trace("parse", parse_lines),
    with_trace("validate", validate_lines),
    with_trace("total", add_line_total),
    with_trace("discount", apply_discount),
    with_trace("tax", add_tax),
    with_trace("format", format_lines),
)

for line in pipeline(RAW_LINES):
    print(line)

# Swap the pipeline: drop apply_discount entirely, re-run just the SKU-3 record, and
# nothing about parse_lines, validate_lines, add_line_total, add_tax or format_lines has to change.
pipeline_no_discount = pipe(parse_lines, validate_lines, add_line_total, add_tax, format_lines)
for line in pipeline_no_discount(["SKU-3,5,2.00"]):
    print("no-discount pipeline ->", line)
# [/usage]
