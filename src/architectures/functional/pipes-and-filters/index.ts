import type { ArchitectureDefinition } from '@/types/architecture'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import pyExample from './example.py?raw'
import goExample from './example.go?raw'
import { PipesAndFiltersVisualization } from './Visualization'

export const architecture: ArchitectureDefinition = {
  slug: 'pipes-and-filters',
  name: 'Pipes and Filters',
  paradigm: 'functional',
  order: 11,
  summary: 'Thread data through an ordered sequence of small, independent filters connected by pipes.',
  intent:
    'Structure a transformation as a series of independent, single-purpose filters, each one consuming a stream of elements and producing another, connected end to end by pipes — so filters can be added, removed, reordered or reused without touching their neighbours.',
  problem:
    'A report job reads raw order-line records, checks each one, computes totals and discounts, and prints a formatted line — all inside one function that loops over the whole file four separate times and hard-codes the order the checks and calculations happen in. Adding a new rule (say, a seasonal discount) means editing that same function and re-testing everything else it does, and nothing can be printed until every record has been read.',
  solution:
    "Break the transformation into small filters — parse, validate, enrich, format — each one a function from a stream of elements to a stream of elements, with no knowledge of what comes before or after it. A pipe()/compose() helper wires them into a pipeline that has that exact same shape, so a whole pipeline can be nested inside a bigger one like any other filter. Because each filter is a lazy generator rather than a function over an in-memory array, elements flow through the entire pipeline one at a time: the first formatted line can be produced before the last raw record has even been read. Filters are added, removed or reordered by editing the pipe() call, never the filters themselves.",
  analogy:
    'A row of inline water filters under a sink: one strips sediment, the next removes chlorine, the last adds a mineral boost — each one just a cylinder with water going in one end and different water coming out the other. You can add a filter mid-chain, skip one, or reorder two of them without taking anything else apart, and water flows continuously through all of them rather than being filtered one full tankful at a time.',
  whenToUse: [
    'A transformation naturally breaks into an ordered sequence of independent steps, each of which could be tested, replaced or reused on its own.',
    'Records should start flowing out the far end of the pipeline before every record has been read in — logs, large files, or unbounded streams.',
    'The exact sequence of steps changes often (a new validation rule, an extra enrichment, a different output format), and each change should touch only one filter.',
    'Several pipelines in the system share some filters but not all of them, e.g. the same parse/validate stages feeding two different downstream formats.',
  ],
  pros: [
    'Each filter is small, independently testable, and ignorant of its neighbours — it only needs to know the shape of what it consumes and produces.',
    'Filters compose: a whole pipeline has the same shape as any one stage, so pipelines can be nested, reused, or passed around like any other filter.',
    'Backed by lazy iterators, a pipeline can start producing output before its input is exhausted, and never has to hold the whole stream in memory at once.',
    "Reordering, inserting, or removing a stage is a one-line change to the pipe() call, with zero changes to any filter's own code.",
  ],
  cons: [
    'A record that should affect more than one later stage at once — not just flow forward — forces awkward workarounds; pipelines are naturally one-directional.',
    'Debugging means tracing a value through every stage it passed through; a bug in one filter can surface as a symptom several stages later.',
    'Pull-based (iterator) pipelines are simple but strictly single-consumer; fanning the same stream out to several independent downstream pipelines needs buffering or a push-based implementation instead.',
    'Very fine-grained filters add call/iteration overhead per element; a pipeline of many tiny filters processing millions of records can be noticeably slower than one hand-fused loop.',
  ],
  realWorld: [
    'Unix shell pipelines (`cat orders.txt | ./parse | ./validate | ./format`) are the original pipes-and-filters architecture, with OS pipes doing the buffering',
    'Kafka Streams, Akka Streams and Reactive Extensions (Rx) implement the same idea for distributed or push-based streaming data',
    'Compiler toolchains are a classic pipes-and-filters design: lexer → parser → type checker → optimizer → code generator',
    "Image- and audio-processing toolkits (ImageMagick's `-filter` chains, GStreamer pipelines) connect independent processing stages the same way",
  ],
  concepts: [
    {
      term: 'Filter',
      description: 'A single, independent processing stage: a function from a stream of input elements to a stream of output elements, with no knowledge of its neighbours.',
    },
    {
      term: 'Pipe',
      description: 'The connector between two filters that moves elements from one to the next. In this example, that connector is simply one generator passed as the input of the next.',
    },
    {
      term: 'pipe() / compose()',
      description: 'A helper that wires filters together end to end into a single new filter with the same shape — a pipeline is, from the outside, indistinguishable from one of its own stages.',
    },
    {
      term: 'Lazy stream',
      description: 'A sequence (generator / IEnumerable / iterator / Go iter.Seq) that computes each element on demand rather than all at once, which is what lets a pipeline process one record at a time.',
    },
    {
      term: 'Pull-based evaluation',
      description: 'The consumer at the end of the pipeline drives the whole thing by asking for the next element; that request propagates backwards through every stage before the first element appears. Push-based streaming works the other way: the source decides when to emit.',
    },
    {
      term: 'Source / sink',
      description: 'The ends of a pipeline: the source produces the very first stream of elements, the sink is whatever finally consumes the output — here, a console.log loop.',
    },
  ],
  variants: [
    {
      name: 'Unix pipes',
      description: 'Independent OS processes connected by anonymous pipes (`a | b | c`), each reading stdin and writing stdout as a byte/line stream; the shell wires file descriptors together the way this example\'s pipe() wires generators together.',
    },
    {
      name: 'Streaming / dataflow (Rx, Akka Streams, Kafka Streams)',
      description: "The same filter-and-pipe shape, but usually push-based: the source emits elements as they become available and downstream stages (and backpressure signals) react, rather than a sink pulling with next() the way this example's for-of loop does.",
    },
    {
      name: 'Batch sequential',
      description: "Each stage runs to completion over the whole collection — essentially chained .map()/.filter() calls over an array — before the next stage starts. Simpler to reason about, but the pipeline can't start producing output, or operate on an unbounded stream, until every prior stage has fully finished.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: 'chain-of-responsibility',
        why: 'Each filter hands its output on to the next stage in a fixed order, the same shape as a chain of handlers — but unlike classic Chain of Responsibility, no stage decides whether to pass a request on unhandled: every stage actually transforms (or explicitly tags as rejected) every record before forwarding it.',
      },
      {
        slug: 'decorator',
        why: "withTrace() wraps each stage in the logged() tracer, which takes an iterable and returns a new iterable of exactly the same element type, adding a trace line per element without the wrapped stage — or the stages around it — ever knowing it is there: Decorator applied to iterators.",
      },
      {
        slug: 'iterator',
        why: 'Every stage — parseLines, validateLines, addLineTotal, applyDiscount, addTax, formatLines — is a lazy generator-style function (generator / IEnumerable iterator / Go iter.Seq), producing one element at a time on demand instead of materializing arrays between stages.',
      },
      {
        slug: 'composite',
        why: 'pipe() composes several filters into a single function with exactly the same Filter<A, B> shape as any one of them, so a whole pipeline can be passed anywhere a single filter is expected, or nested inside a larger pipe() call.',
      },
      {
        slug: 'strategy',
        why: "Each stage is an ordinary function value passed into pipe() — swapping formatLines for a different formatter, or applyDiscount for a different pricing rule, changes the pipeline's behaviour without touching any other stage, exactly like swapping a Strategy.",
      },
    ],
    architectures: [
      {
        slug: 'functional-core',
        why: 'Every filter (parseLines, validateLines, addLineTotal, applyDiscount, addTax, formatLines) is a pure function from one stream of values to another; the only impure code is the console.log calls inside logged() and the loop that drives the pipeline — the imperative shell around this pure core.',
      },
      {
        slug: 'event-driven',
        why: 'Streaming implementations of this pattern (Kafka Streams, Rx, Akka Streams) commonly sit downstream of an event broker, turning each published event into one more element flowing through the same parse → validate → enrich → format pipeline.',
      },
    ],
  },

  // Diagram (viewBox 800 × 490, x/y are box centres). Two rows, snaking left-to-right then
  // left-to-right again, to fit all six filters plus a source and sink in one readable diagram.
  viewBox: '0 0 800 490',
  participants: [
    {
      id: 'source',
      label: 'Order Lines',
      role: 'Source',
      kind: 'object',
      x: 90,
      y: 110,
      description: 'Four raw text records, one per order line, including one malformed entry. The source is just a plain collection of strings — any iterable would do.',
      code: 'usage',
    },
    {
      id: 'parse',
      label: 'parseLines()',
      role: 'Filter · parse',
      kind: 'object',
      x: 320,
      y: 110,
      width: 150,
      description: 'Pure generator that splits each raw line on commas into a Candidate of up to three fields. It never rejects anything itself — it only restructures text.',
      patterns: ['iterator'],
    },
    {
      id: 'validate',
      label: 'validateLines()',
      role: 'Filter · validate',
      kind: 'object',
      x: 560,
      y: 110,
      width: 160,
      description: 'Checks the SKU, quantity and price format of each candidate. A record that fails any check is tagged rejected with a reason and still flows downstream unchanged; everything else is parsed into numbers.',
    },
    {
      id: 'total',
      label: 'addLineTotal()',
      role: 'Filter · enrich',
      kind: 'object',
      x: 680,
      y: 230,
      width: 150,
      description: 'Multiplies quantity by unit price (in integer cents) for every valid line. Rejected lines pass straight through untouched.',
    },
    {
      id: 'discount',
      label: 'applyDiscount()',
      role: 'Filter · pluggable',
      kind: 'object',
      x: 470,
      y: 350,
      width: 160,
      description: "Gives a 10% discount to lines ordering 5 or more units. This filter was added to the pipeline after the fact — a one-line change to the pipe() call — without editing parse, validate, the total filter, tax or format.",
      patterns: ['strategy'],
    },
    {
      id: 'tax',
      label: 'addTax()',
      role: 'Filter · enrich',
      kind: 'object',
      x: 250,
      y: 350,
      width: 140,
      description: "Adds 8% tax on whatever the line's current total is, after any discount already applied. Tax lands on the discounted amount only because of the order the filters were composed in, not because of anything in either filter's own code.",
    },
    {
      id: 'format',
      label: 'formatLines()',
      role: 'Filter · format',
      kind: 'object',
      x: 90,
      y: 350,
      width: 140,
      description: 'Renders a human-readable line for a valid record, or a REJECTED message for one that validate tagged. Swapping this one function for another (CSV, JSON) changes only the output shape.',
      patterns: ['strategy'],
    },
    {
      id: 'sink',
      label: 'console.log',
      role: 'Sink',
      kind: 'client',
      x: 90,
      y: 440,
      width: 130,
      description: 'Prints each formatted string as soon as it arrives. Because the whole pipeline is built from generators, this final loop is what actually drives every upstream pull, one record at a time.',
      code: 'usage',
    },
  ],
  relations: [
    { id: 'toParse', from: 'source', to: 'parse', type: 'calls', label: 'raw line', description: 'A raw string leaves the source and is handed to parseLines.', code: 'parse' },
    { id: 'toValidate', from: 'parse', to: 'validate', type: 'calls', label: 'candidate', description: 'The split-but-unjudged Candidate moves on to validateLines.', code: 'validate' },
    { id: 'toTotal', from: 'validate', to: 'total', type: 'calls', label: 'valid or rejected line', description: 'A tagged Line — valid with parsed numbers, or rejected with a reason — reaches addLineTotal.', bend: 20, code: 'total' },
    { id: 'toDiscount', from: 'total', to: 'discount', type: 'calls', label: 'line + total', description: 'The line, now carrying lineTotalCents, is handed to applyDiscount.', bend: -30, code: 'discount' },
    { id: 'toTax', from: 'discount', to: 'tax', type: 'calls', label: 'line ± discount', description: "The line moves to addTax carrying whatever discountCents applyDiscount gave it — zero for most lines.", code: 'tax' },
    { id: 'toFormat', from: 'tax', to: 'format', type: 'calls', label: 'line + tax', description: 'The fully enriched line, with its total, discount and tax all computed, reaches formatLines.', code: 'format' },
    { id: 'toSink', from: 'format', to: 'sink', type: 'calls', label: 'formatted string', description: 'The rendered string (or REJECTED message) is printed as soon as it is produced.', bend: 20, code: 'usage' },
  ],

  // Animated scenario
  steps: [
    {
      title: 'Six independent filters, one fixed pipe',
      description:
        'Four raw order-line records flow left to right through parse, validate, enrich (total, discount, tax) and format. Each filter only knows the shape of what it consumes and produces — never what its neighbours do.',
      highlight: ['source', 'parse', 'validate', 'total', 'discount', 'tax', 'format', 'sink'],
    },
    {
      title: 'parse splits each raw line into fields',
      description: 'parseLines turns each of the 4 raw strings into a Candidate of up to three comma-separated fields. It never judges whether those fields are valid — it only restructures text.',
      highlight: ['source', 'toParse', 'parse'],
      packets: [{ relation: 'toParse', label: 'raw line' }],
      notes: { parse: '4 candidates' },
      code: 'parse',
    },
    {
      title: 'validate drops and reports the one bad line',
      description: '"bad-line" has no commas, so validateLines tags it rejected with a reason — and still lets it flow downstream, lazily, instead of throwing it away outright. The other 3 candidates pass through as valid lines with parsed numbers.',
      highlight: ['parse', 'toValidate', 'validate'],
      packets: [{ relation: 'toValidate', label: 'candidate' }],
      notes: { validate: '1 rejected, 3 valid' },
      code: 'validate',
    },
    {
      title: 'enrich adds the line total',
      description: 'addLineTotal multiplies qty × unit price in cents for every valid line (SKU-1: 2×$9.99=$19.98, SKU-3: 5×$2.00=$10.00, SKU-4: 1×$19.99=$19.99). The rejected line passes through untouched.',
      highlight: ['validate', 'toTotal', 'total'],
      packets: [{ relation: 'toTotal', label: 'valid or rejected line' }],
      notes: { total: '+lineTotalCents' },
      code: 'total',
    },
    {
      title: 'A pluggable discount filter',
      description: 'applyDiscount only touches lines ordering 5 or more units — here, just SKU-3 — giving it a 10% discount ($10.00 → $9.00 net). This filter was slotted into the pipeline without changing parse, validate, the total filter, tax or format at all.',
      highlight: ['total', 'toDiscount', 'discount'],
      packets: [{ relation: 'toDiscount', label: 'line + total' }],
      notes: { discount: 'SKU-3: -$1.00' },
      code: 'discount',
    },
    {
      title: 'Tax lands on whatever total the line currently has',
      description: "addTax applies 8% to the line's current total — after any discount already applied. SKU-3 is taxed on its discounted $9.00, not its original $10.00, purely because discount runs before tax in the pipe() call; swapping that order would change this without editing either filter.",
      highlight: ['discount', 'toTax', 'tax'],
      packets: [{ relation: 'toTax', label: 'line ± discount' }],
      notes: { tax: '8% of net total' },
      code: 'tax',
    },
    {
      title: 'format renders one record at a time',
      description: 'formatLines turns each enriched Line into its final string (or a REJECTED message). Because every stage is a generator, the trace in the console shows each record pulled all the way through parse → validate → total → discount → tax → format before the next record starts — nothing is processed in batches.',
      highlight: ['tax', 'toFormat', 'format'],
      packets: [{ relation: 'toFormat', label: 'line + tax' }],
      notes: { format: '4 lines rendered' },
      code: 'format',
    },
    {
      title: 'Swap a filter without touching the others',
      description: "pipelineNoDiscount is built by leaving applyDiscount out of the pipe() call and reusing parseLines, validateLines, addLineTotal, addTax and formatLines exactly as they are. Re-running just the SKU-3 record through it prints $10.80 instead of $9.72 — proof that the other five filters never had to change.",
      highlight: ['format', 'toSink', 'sink'],
      packets: [{ relation: 'toSink', label: 'formatted string' }],
      notes: { sink: 'no-discount run: $10.80' },
      code: 'usage',
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: PipesAndFiltersVisualization,
}
