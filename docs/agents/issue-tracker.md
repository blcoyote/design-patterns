# Issue tracker: Beads (bd)

Issues for this repo live in beads, a Dolt-backed tracker driven by the `bd` CLI. Do not use GitHub Issues, `.scratch/` files, TodoWrite or markdown TODO lists. `CLAUDE.md` ("Beads issue tracking") has the project rules; this file maps the skills' operations onto `bd`.

## Conventions

- Priority is 0-4 (0 = critical, 2 = medium, 4 = backlog), not high/medium/low.
- Specs are `epic` issues; implementation tickets are children created with `--parent <epic-id>`.
- Triage state is a `bd` label (see `triage-labels.md`).
- Never run `bd edit` (it opens `$EDITOR`); use `bd update <id> --description/--notes/--design`.
- Sync with `bd dolt pull` at session start and `bd dolt push` after creating or closing issues. Don't commit or push to git unless asked.

## When a skill says "publish to the issue tracker"

`bd create --title "..." --description "..." --type task|bug|feature|epic --priority 2 [--parent <id>] [-l <label>]`

Use `--body-file -` for long descriptions. Link ordering with `bd dep add <issue> <depends-on>`.

## When a skill says "fetch the relevant ticket"

`bd show <id>` (add `bd comments <id>` for the discussion).

## Common operations

- Find work: `bd ready`, `bd list --status open`, `bd search <query>`
- Comment: `bd comments add <id> "text"`
- Add/remove label: `bd update <id> --add-label X --remove-label Y`
- Filter by label: `bd list -l <label>` (AND) or `--label-any a,b`
- Claim: `bd update <id> --claim`
- Close: `bd close <id> [--reason "..."]`

## Wayfinding operations

Used by `/wayfinder`. The **map** is an `epic`; each **child** ticket is a `bd` issue under it.

- **Map**: an epic whose description holds the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `bd create --parent <map-id> --type spike|task ...`; record the ticket type (`research`/`prototype`/`grilling`/`task`) as a label `type:<kind>`.
- **Blocking**: `bd dep add <ticket> <blocker>`. Unblocked means `bd ready` lists it.
- **Frontier**: `bd ready` filtered to the map's children; lowest id first.
- **Claim**: `bd update <id> --claim` before any work.
- **Resolve**: `bd comments add <id> "<answer>"`, `bd close <id>`, then append a context pointer (gist + id) to the map epic's Decisions-so-far via `bd update <map-id> --description ...`.
