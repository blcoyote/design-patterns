// Side-effect import first: sets `globalThis.Prism` to the instance used by
// prism-react-renderer before the language grammar below registers itself
// onto it. See prismGlobal.ts for why this ordering matters.
import { Prism } from './prismGlobal'
import 'prismjs/components/prism-csharp'

export { Prism }
