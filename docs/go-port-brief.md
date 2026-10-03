# Go port brief (temporary: folded into CLAUDE.md/README by the REVIEW bead, then deleted)

You are adding `example.go` to the pattern/architecture folders listed in your bead. Follow `CLAUDE.md` in full. The TS, C# and Python examples are the source of truth for the scenario.

## Per folder
1. Read `index.ts`, `example.ts`, `example.cs`, `example.py` completely, plus the step notes and descriptions.
2. Write `example.go` in the same folder:
   - Single file, `package main`, imports first, usage in `func main()` at the bottom (see `src/patterns/_template/example.go`).
   - **Exactly the same region ids** as the other three files, using `// [id]` / `// [/id]` on their own lines. Each region must wrap the Go code that the step note / participant describes. The `usage` region wraps `func main()`.
   - Same roles, names (idiomatic Go casing is fine: exported methods PascalCase), values and printed output as the other languages. Output of `go run` must equal the Python output line for line.
   - Keep GoF role names. Go shortcuts (funcs as strategies, channels as observers, embedding as inheritance) get a comment saying so, not a silent substitution.
3. In `index.ts` add `import goExample from './example.go?raw'` next to the others and `go: goExample` next to `python:`. Touch nothing else in `index.ts` unless a description names a language-specific mechanism: then name Go's too, or use neutral wording.
4. Do NOT edit shared code (`src/lib`, `src/components`, `src/hooks`, `src/types`, tests, templates) or other folders.

## Go parity traps
- Map iteration order is random. Never `range` a map when order is observable: use a slice, or a slice of keys.
- Rounding: use `math.Round` (half away from zero, like JS `Math.round`). Avoid `%.2f` on values that sit on a .5 boundary; format explicitly and check against the other languages.
- Number printing: `fmt.Println(float64)` can print `1e+06`; check output matches. Prefer integers or explicit `strconv.FormatFloat`.
- Snapshot vs live iteration: `slices.Clone` before ranging when TS iterates a copy, and be careful that `range` over a slice evaluates it once.
- Remove-first vs remove-all must match the other languages.
- IDs: counters, never `time` or `math/rand`.
- Goroutines only where the TS example is async; keep output deterministic with channels or `sync.WaitGroup`, never rely on scheduling.
- A nil `*T` stored in an interface is non-nil: matters for Null Object and optional collaborators.
- Comments must be literally true in Go (for example "unexported, so other packages cannot mutate it" is true only for lower-case identifiers; in `package main` there are no other packages, so word it carefully).
- Value vs pointer receivers: a struct stored in an interface and mutated needs a pointer receiver. Copying a struct copies it (Memento/Prototype: say which is shallow).
- Unused imports/variables are compile errors; `go vet` must be clean.

## Verify each folder (all must pass; report actual output)
```bash
gofmt -l <folder>/example.go          # prints nothing
go vet <folder>/example.go
go run <folder>/example.go            # compare line by line with: python3 <folder>/example.py
npm test -- src/patterns src/architectures   # marker/region parity for go
npx tsc -b
npm run lint
```
Also confirm that every number in the step `notes` is reproducible by the Go run.

## Bead workflow
- `bd update <id> --claim` at start; `bd close <id> --reason "..."` when all folders pass.
- If the existing TS/C#/Python examples disagree with each other or with their notes, do NOT fix them silently: `bd create "Discrepancy: <slug> ..." --deps discovered-from:<your-id>` with details, port the TS behaviour, and mention it in your report.
- Do not commit. Report per folder: status, `go run` output matches (yes/no), anything odd.
