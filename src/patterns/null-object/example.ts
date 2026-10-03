// Shared types used by both versions below.
interface ReportData {
  rows: unknown[]
}
interface Report {
  warnings: string[]
}
function buildReport(data: ReportData): Report {
  return { warnings: data.rows.length > 2 ? ['low confidence'] : [] }
}

const cleanData: ReportData = { rows: [1, 2] }
const dataWithWarnings: ReportData = { rows: [1, 2, 3] }

// ============================================================
// Before: "no logger" is represented by null.
// ============================================================
// [before]
interface Logger {
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
}

class ReportGeneratorBefore {
  constructor(private logger: Logger | null) {}

  generate(data: ReportData): Report {
    // [guard]
    if (this.logger != null) this.logger.info('starting report')
    const result = buildReport(data)
    if (this.logger != null) this.logger.info('report ready')
    // [/guard]

    // [forgotten]
    if (result.warnings.length > 0) {
      // forgot the null check every other call site remembered. In plain JS,
      // or any non-strict codebase, this compiles fine and crashes at runtime;
      // strict TS instead refuses to compile it, forcing a guard (or "!"/"?.")
      // at every single call site — exactly the clutter Null Object removes.
      // @ts-expect-error — strict null checks catch what a guard would miss at runtime
      this.logger.warn(`report has ${result.warnings.length} warnings`)
    }
    // [/forgotten]

    return result
  }
}

// Fine on the happy path — the guarded calls just no-op:
new ReportGeneratorBefore(null).generate(cleanData)

// Crashes the moment a report has warnings:
try {
  new ReportGeneratorBefore(null).generate(dataWithWarnings)
} catch (err) {
  console.log(`crashed: ${(err as Error).message}`)
}
// TypeError: Cannot read properties of null (reading 'warn')
// [/before]

// ============================================================
// After: a Null Object stands in for "no logger".
// ============================================================
// [logger]
interface Logger {
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
}
// [/logger]

// [nullLogger]
class NullLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
}
// [/nullLogger]

// [consoleLogger]
class ConsoleLogger implements Logger {
  info(msg: string): void {
    console.info(msg)
  }
  warn(msg: string): void {
    console.warn(msg)
  }
  error(msg: string): void {
    console.error(msg)
  }
}
// [/consoleLogger]

// [reportGenerator]
class ReportGenerator {
  // [holds]
  constructor(private logger: Logger = new NullLogger()) {}
  // [/holds]

  // [generate]
  generate(data: ReportData): Report {
    this.logger.info('starting report')
    const result = buildReport(data)
    this.logger.info('report ready')
    if (result.warnings.length > 0) {
      this.logger.warn(`report has ${result.warnings.length} warnings`)
    }
    return result
  }
  // [/generate]
}
// [/reportGenerator]

// [client]
// Usage
const quiet = new ReportGenerator() // no logger passed — defaults to NullLogger
quiet.generate(dataWithWarnings) // runs to completion: no guard, no crash, no noise

const verbose = new ReportGenerator(new ConsoleLogger())
verbose.generate(dataWithWarnings) // the exact same generate() — now it actually logs
// [/client]
