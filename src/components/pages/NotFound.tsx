import { Link } from "react-router-dom";
import { Seo } from "@/components/content/Seo";
import { notFoundSeoPage } from "@/lib/seoPages";

export function NotFound() {
  return (
    <div className="py-24 text-center">
      <Seo page={notFoundSeoPage} />
      <p className="font-mono text-sm text-fg-subtle">404</p>
      <h1 className="mt-2 text-3xl font-bold text-fg">Pattern not found</h1>
      <p className="mt-3 text-fg-muted">
        That page doesn’t exist — maybe it’s a pattern we haven’t added yet.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-control bg-surface-raised px-4 py-2 text-sm text-fg hover:bg-surface-strong"
      >
        Back to all patterns
      </Link>
    </div>
  );
}
