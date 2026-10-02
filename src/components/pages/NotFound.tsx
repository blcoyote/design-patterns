import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-sm text-slate-500">404</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Pattern not found</h1>
      <p className="mt-3 text-slate-400">That page doesn’t exist — maybe it’s a pattern we haven’t added yet.</p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
        Back to all patterns
      </Link>
    </div>
  )
}
