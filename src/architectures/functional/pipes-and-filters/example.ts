// [types]
/** What parse() produces: a raw line split into (at most) its comma-separated fields. */
interface Candidate {
  readonly lineNo: number
  readonly raw: string
  readonly fields: readonly string[]
}

/**
 * The record every later filter passes along. Rejected lines carry a reason and flow
 * through untouched; valid lines pick up more fields (lineTotalCents, discountCents,
 * taxCents) as they move through the pipeline.
 */
interface Line {
  readonly lineNo: number
  readonly raw: string
  readonly rejected: boolean
  readonly reason?: string
  readonly sku?: string
  readonly qty?: number
  readonly unitPriceCents?: number
  readonly lineTotalCents?: number
  readonly discountCents?: number
  readonly taxCents?: number
}

const SKU_RE = /^SKU-\d+$/
const QTY_RE = /^\d+$/
// Exactly two decimal digits, so the cents can be read straight out of the string —
// no floating-point multiplication (and its rounding surprises) anywhere near money.
const PRICE_RE = /^\d+\.\d{2}$/

function centsToDollars(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
// [/types]

// [pipe]
/** One pipeline stage: a function from a stream of `A` to a stream of `B`. */
type Filter<A, B> = (input: Iterable<A>) => Iterable<B>

// A pipeline built from several filters has exactly the same shape as any one of
// them (Iterable<A> in, Iterable<B> out) — that is what lets pipe() nest pipelines
// inside bigger pipelines like any other filter.
function pipe<A, B>(f1: Filter<A, B>): Filter<A, B>
function pipe<A, B, C>(f1: Filter<A, B>, f2: Filter<B, C>): Filter<A, C>
function pipe<A, B, C, D>(f1: Filter<A, B>, f2: Filter<B, C>, f3: Filter<C, D>): Filter<A, D>
function pipe<A, B, C, D, E>(f1: Filter<A, B>, f2: Filter<B, C>, f3: Filter<C, D>, f4: Filter<D, E>): Filter<A, E>
function pipe<A, B, C, D, E, F>(
  f1: Filter<A, B>,
  f2: Filter<B, C>,
  f3: Filter<C, D>,
  f4: Filter<D, E>,
  f5: Filter<E, F>,
): Filter<A, F>
function pipe<A, B, C, D, E, F, G>(
  f1: Filter<A, B>,
  f2: Filter<B, C>,
  f3: Filter<C, D>,
  f4: Filter<D, E>,
  f5: Filter<E, F>,
  f6: Filter<F, G>,
): Filter<A, G>
function pipe(...fns: Filter<unknown, unknown>[]): Filter<unknown, unknown> {
  return (input) => fns.reduce<Iterable<unknown>>((acc, fn) => fn(acc), input)
}

/**
 * A decorator for iterators: wraps any stream in another stream with the exact same
 * Iterable<T> interface, logging each element as it is pulled through. It adds
 * behaviour (the trace) without the filters it wraps ever knowing it is there.
 */
function* logged<T>(label: string, source: Iterable<T>): Generator<T> {
  let n = 0
  for (const item of source) {
    n++
    console.log(`  [${label}] pulled #${n}`)
    yield item
  }
}

function withTrace<A, B>(label: string, filter: Filter<A, B>): Filter<A, B> {
  return (input) => logged(label, filter(input))
}
// [/pipe]

// [parse]
/**
 * Pure filter: splits each raw line on commas. It never judges whether the result
 * looks like a valid order line — that is validate()'s job, not parse()'s.
 */
function* parseLines(lines: Iterable<string>): Generator<Candidate> {
  let lineNo = 0
  for (const raw of lines) {
    lineNo++
    yield { lineNo, raw, fields: raw.split(',').map((f) => f.trim()) }
  }
}
// [/parse]

// [validate]
/**
 * Pure filter: the one place that decides a line is bad. A candidate that fails any
 * check becomes a rejected Line (reported, not thrown away) and still flows through
 * every later filter unchanged; everything else becomes a valid Line with parsed
 * numbers instead of text.
 */
function* validateLines(candidates: Iterable<Candidate>): Generator<Line> {
  for (const c of candidates) {
    if (c.fields.length !== 3) {
      yield { lineNo: c.lineNo, raw: c.raw, rejected: true, reason: 'expected sku,qty,price' }
      continue
    }
    const [sku, qtyText, priceText] = c.fields
    if (!SKU_RE.test(sku)) {
      yield { lineNo: c.lineNo, raw: c.raw, rejected: true, reason: `invalid sku "${sku}"` }
      continue
    }
    if (!QTY_RE.test(qtyText) || Number(qtyText) <= 0) {
      yield { lineNo: c.lineNo, raw: c.raw, rejected: true, reason: 'quantity must be a positive integer' }
      continue
    }
    if (!PRICE_RE.test(priceText)) {
      yield { lineNo: c.lineNo, raw: c.raw, rejected: true, reason: 'price must look like 9.99' }
      continue
    }
    yield {
      lineNo: c.lineNo,
      raw: c.raw,
      rejected: false,
      sku,
      qty: Number(qtyText),
      unitPriceCents: Number(priceText.replace('.', '')),
    }
  }
}
// [/validate]

// [total]
/** Pure filter: adds the line total, in integer cents. Rejected lines pass through untouched. */
function* addLineTotal(lines: Iterable<Line>): Generator<Line> {
  for (const line of lines) {
    if (line.rejected) {
      yield line
      continue
    }
    yield { ...line, lineTotalCents: line.qty! * line.unitPriceCents! }
  }
}
// [/total]

// [discount]
const DISCOUNT_MIN_QTY = 5
const DISCOUNT_RATE = 0.1

/**
 * Pure filter, added to the pipeline after the other four already existed — a 10%
 * discount for orders of 5 or more units. Nothing about parse, validate, addLineTotal,
 * addTax or formatLines changed to make room for it; only the pipe() call did.
 */
function* applyDiscount(lines: Iterable<Line>): Generator<Line> {
  for (const line of lines) {
    if (line.rejected || line.qty! < DISCOUNT_MIN_QTY) {
      yield line
      continue
    }
    const discountCents = Math.round(line.lineTotalCents! * DISCOUNT_RATE)
    yield { ...line, discountCents }
  }
}
// [/discount]

// [tax]
const TAX_RATE = 0.08

/**
 * Pure filter: 8% tax on whatever the line's total currently is. Because this filter
 * runs after applyDiscount in the pipe() call below, it taxes the discounted amount —
 * that is a property of the ordering, not of either filter's own code.
 */
function* addTax(lines: Iterable<Line>): Generator<Line> {
  for (const line of lines) {
    if (line.rejected) {
      yield line
      continue
    }
    const netCents = line.lineTotalCents! - (line.discountCents ?? 0)
    yield { ...line, taxCents: Math.round(netCents * TAX_RATE) }
  }
}
// [/tax]

// [format]
function formatLine(line: Line): string {
  if (line.rejected) {
    return `REJECTED line ${line.lineNo}: "${line.raw}" — ${line.reason}`
  }
  const netCents = line.lineTotalCents! - (line.discountCents ?? 0)
  const finalCents = netCents + line.taxCents!
  const discountPart = line.discountCents
    ? ` - discount ${centsToDollars(line.discountCents)} (net ${centsToDollars(netCents)})`
    : ''
  return (
    `${line.sku} x${line.qty} @ ${centsToDollars(line.unitPriceCents!)} = ${centsToDollars(line.lineTotalCents!)}` +
    `${discountPart} + tax ${centsToDollars(line.taxCents!)} = ${centsToDollars(finalCents)}`
  )
}

/** Pluggable, swappable filter: a different formatLine would change only the output shape. */
function* formatLines(lines: Iterable<Line>): Generator<string> {
  for (const line of lines) yield formatLine(line)
}
// [/format]

// [usage]
const RAW_LINES = ['SKU-1,2,9.99', 'bad-line', 'SKU-3,5,2.00', 'SKU-4,1,19.99']

const pipeline = pipe(
  withTrace('parse', parseLines),
  withTrace('validate', validateLines),
  withTrace('total', addLineTotal),
  withTrace('discount', applyDiscount),
  withTrace('tax', addTax),
  withTrace('format', formatLines),
)

for (const line of pipeline(RAW_LINES)) {
  console.log(line)
}

// Swap the pipeline: drop applyDiscount entirely, re-run just the SKU-3 record, and
// nothing about parse, validate, addLineTotal, addTax or formatLines has to change.
const pipelineNoDiscount = pipe(parseLines, validateLines, addLineTotal, addTax, formatLines)
for (const line of pipelineNoDiscount(['SKU-3,5,2.00'])) {
  console.log('no-discount pipeline ->', line)
}
// [/usage]
