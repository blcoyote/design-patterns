import type { PatternDefinition } from '@/types/pattern'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import pyExample from './example.py?raw'
import { NullObjectVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'null-object',
  name: 'Null Object',
  category: 'architectural',
  order: 6,
  summary: 'Replace null checks with a do-nothing object that implements the same interface.',
  intent:
    'Provide an object with neutral, "do nothing" behavior that implements the same interface as a real collaborator, so client code can call it unconditionally instead of checking for null everywhere.',
  problem:
    'A ReportGenerator accepts an optional Logger. Every caller that legitimately has "no logger" passes null, and every line in generate() that wants to log first has to ask if (this.logger != null). One forgotten check anywhere in the codebase is a null-pointer crash waiting to happen — and it eventually happens, in production, the one time a report has warnings.',
  solution:
    'Introduce a NullLogger that implements the same Logger interface as any real logger, but whose methods quietly do nothing. ReportGenerator defaults to a NullLogger instead of accepting null, so the logger field is always a real object. Every call site can call logger.info()/warn()/error() unconditionally — the Null Object absorbs the "nothing to do" case so client code never has to.',
  analogy:
    '/dev/null accepts anything written to it and discards it. Nothing that writes there needs to check whether a real destination exists first — /dev/null is a real, well-behaved destination that simply does nothing with its input.',
  whenToUse: [
    'A dependency is often "absent" (no logger, no cache, no handler) and callers keep checking for null before using it.',
    'You want to eliminate repeated if (x != null) guards scattered across a codebase.',
    'The "do nothing" behavior is a legitimate, intentional default — not a bug waiting to be reported.',
  ],
  pros: [
    'Removes null checks from client code — every call site can use the collaborator unconditionally.',
    'The "do nothing" behavior lives in one place (the Null Object) instead of being reimplemented at every guard.',
    'Satisfies the interface fully, so a real implementation can be swapped in later with no changes anywhere else.',
  ],
  cons: [
    'Can hide real bugs: a missing dependency sometimes should be a loud error, not a silent no-op.',
    'Adds a class that does nothing observable, which can confuse readers unfamiliar with the pattern.',
    'Does not help when callers need a meaningful return value — a safe default return is a smaller cousin of this, not a true Null Object.',
    'Only works when "do nothing" is itself a genuinely sensible default; if no neutral behavior exists, forcing one in is the wrong fix.',
  ],
  realWorld: [
    'NullLogger / NOPLogger implementations in logging frameworks (SLF4J\'s NOPLogger, many Node logging libs)',
    'Python\'s logging.NullHandler — attached by libraries so "no handler configured" never warns or crashes',
    'A never-aborting `new AbortController().signal` used as a safe default instead of undefined',
    '.NET\'s NullLogger.Instance, Stream.Null, Go\'s io.Discard, and Java\'s Collections.emptyList() — do-nothing implementations used as defaults instead of null',
  ],
  related: ['strategy', 'singleton', 'proxy', 'state'],

  participants: [
    {
      id: 'logger',
      label: 'Logger',
      role: 'Logger interface',
      kind: 'interface',
      x: 450,
      y: 60,
      description: 'Declares info(), warn() and error(). ReportGenerator depends only on this — never on a concrete logger, and never on null.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 120,
      y: 250,
      description: 'Constructs a ReportGenerator and calls generate(). Before the fix it sometimes passed null for "no logger"; after, it simply omits the argument or passes a real one.',
    },
    {
      id: 'reportGenerator',
      label: 'ReportGenerator',
      role: 'Context',
      kind: 'class',
      x: 400,
      y: 250,
      width: 170,
      description: 'Holds a logger and calls it while generating a report. Once the field can never be null, every log call can be made unconditionally — no guards anywhere in generate().',
    },
    {
      id: 'nullLogger',
      label: 'NullLogger',
      role: 'Null Object',
      kind: 'class',
      x: 680,
      y: 150,
      description: 'Implements Logger, but every method is an intentional no-op. Stands in for "no logger" so ReportGenerator never has to handle null as a special case.',
    },
    {
      id: 'consoleLogger',
      label: 'ConsoleLogger',
      role: 'Concrete Logger',
      kind: 'class',
      x: 680,
      y: 350,
      description: 'A real Logger that writes to the console. Can replace NullLogger at any time — generate() cannot tell the difference.',
    },
  ],

  relations: [
    {
      id: 'holds',
      from: 'reportGenerator',
      to: 'logger',
      type: 'holds',
      label: 'logger',
      description: 'ReportGenerator stores its logger typed only as Logger, defaulted to a NullLogger instead of null. The field is never empty.',
      code: 'holds',
    },
    {
      id: 'null-impl',
      from: 'nullLogger',
      to: 'logger',
      type: 'implements',
      description: 'NullLogger implements Logger just like any real logger would — it is a fully legitimate instance, not a special null value.',
      bend: -25,
      code: 'nullLogger',
    },
    {
      id: 'console-impl',
      from: 'consoleLogger',
      to: 'logger',
      type: 'implements',
      description: 'ConsoleLogger implements Logger and actually writes to the console.',
      bend: 25,
      code: 'consoleLogger',
    },
    {
      id: 'client-create',
      from: 'client',
      to: 'reportGenerator',
      type: 'creates',
      label: 'new ReportGenerator()',
      description: 'The client constructs a ReportGenerator. Before the fix it could pass null here; after, omitting the argument safely defaults to a NullLogger.',
      bend: -25,
      code: 'client',
    },
    {
      id: 'client-call',
      from: 'client',
      to: 'reportGenerator',
      type: 'calls',
      label: 'generate()',
      description: 'The client calls generate() the same way no matter what kind of logger (or lack of one) is behind it.',
      bend: 25,
      code: 'client',
    },
    {
      id: 'call-null',
      from: 'reportGenerator',
      to: 'nullLogger',
      type: 'calls',
      label: 'logger.*()',
      description: 'When the current logger is a NullLogger, generate() still calls info()/warn()/error() unconditionally — they simply do nothing.',
      bend: 15,
      code: 'generate',
    },
    {
      id: 'call-console',
      from: 'reportGenerator',
      to: 'consoleLogger',
      type: 'calls',
      label: 'logger.*()',
      description: 'The exact same unconditional calls, now reaching a ConsoleLogger that actually prints.',
      bend: -15,
      code: 'generate',
    },
  ],

  steps: [
    {
      title: 'Before: null means "no logger"',
      description:
        'A batch job builds a ReportGenerator and passes null for the logger, since it does not want console noise. The field is typed as an optional Logger (Logger | null, ILogger?, Logger | None), so every call site that wants to log now has to remember to guard it.',
      highlight: ['client', 'client-create', 'reportGenerator'],
      packets: [{ relation: 'client-create', label: 'new ReportGenerator(null)' }],
      notes: { reportGenerator: 'logger: null' },
      code: 'before',
    },
    {
      title: 'Two guarded calls behave',
      description:
        'generate() checks that the logger is not null before its first two log calls. Since logger really is null here, both checks correctly skip the call and the method carries on safely.',
      highlight: ['client', 'client-call', 'reportGenerator'],
      packets: [{ relation: 'client-call', label: 'generate()' }],
      notes: { reportGenerator: 'guards: 2 skipped' },
      code: 'guard',
    },
    {
      title: 'One guard was never written',
      description:
        'When the report has warnings, generate() calls this.logger.warn(...) directly — whoever added that branch forgot the null check every other call site remembered.',
      highlight: ['reportGenerator'],
      notes: { reportGenerator: 'warnings: 1' },
      code: 'forgotten',
    },
    {
      title: 'It crashes',
      description:
        "Because logger is null, the .warn() call throws (TypeError in TS, NullReferenceException in C#, AttributeError in Python). The exception unwinds past generate() and the whole report is lost — for want of one if.",
      highlight: ['client', 'reportGenerator'],
      notes: { reportGenerator: '💥 crash' },
      code: 'forgotten',
    },
    {
      title: 'After: give "no logger" its own class',
      description:
        'NullLogger implements the same Logger interface as any real logger, but every method is a deliberate no-op. It is a legitimate, fully-formed Logger — just a quiet one.',
      highlight: ['nullLogger', 'null-impl', 'logger'],
      code: 'nullLogger',
    },
    {
      title: 'Default to it instead of null',
      description:
        "ReportGenerator's constructor now defaults logger to new NullLogger() when the caller omits one. The field is always a real Logger — never null — so the type itself rules out the crash.",
      highlight: ['client', 'client-create', 'holds', 'reportGenerator'],
      packets: [{ relation: 'client-create', label: 'new ReportGenerator()' }],
      notes: { reportGenerator: 'logger: NullLogger' },
      code: 'holds',
    },
    {
      title: 'generate() needs no guards at all',
      description:
        'Every call — info(), info(), warn() — is made unconditionally. When the logger is a NullLogger, each call quietly does nothing; the method never has to ask whether logging is wanted.',
      highlight: ['client', 'client-call', 'reportGenerator', 'call-null', 'nullLogger'],
      packets: [
        { relation: 'client-call', label: 'generate()' },
        { relation: 'call-null', label: 'logger.warn()' },
      ],
      notes: { nullLogger: 'no-op' },
      code: 'generate',
    },
    {
      title: 'Swap in a real logger — same call path',
      description:
        'Pass a ConsoleLogger instead and nothing about generate() changes. The exact same unguarded calls now print to the console, proving the call path never needed to know which Logger it had.',
      highlight: ['client', 'client-call', 'reportGenerator', 'call-console', 'consoleLogger', 'console-impl'],
      packets: [
        { relation: 'client-call', label: 'generate()' },
        { relation: 'call-console', label: 'logger.warn()' },
      ],
      notes: { consoleLogger: 'printed', reportGenerator: 'logger: ConsoleLogger' },
      code: 'consoleLogger',
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  Visualization: NullObjectVisualization,
}
