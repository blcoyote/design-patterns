import { Prism } from 'prism-react-renderer'

/**
 * `prismjs/components/prism-*` language files are plain UMD-ish scripts that
 * expect a global `Prism` to already exist — each does
 * `(function (Prism) { ... }(Prism))`, reading the bare identifier from the
 * global scope. We point that global at the exact Prism instance
 * `prism-react-renderer` renders with, so grammars registered here (see
 * `./prism.ts`) are visible to its `<Highlight>` component.
 *
 * This must be imported — and finish evaluating — before any
 * `prismjs/components/...` module is imported. Keep it in its own
 * side-effect-only module: ES imports are hoisted, so doing the assignment
 * inline in the same file as the component import would not guarantee
 * ordering, but importing this module first in another file does, because
 * module evaluation follows import order depth-first.
 */
;(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism

export { Prism }
