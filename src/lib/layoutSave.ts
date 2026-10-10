import type { LayoutOverrides } from "@/lib/layoutEdit";

/** Where the dev server's layout writer (vite-plugins/layoutWriter.ts) listens. */
export const LAYOUT_SAVE_URL = "/__dev/layout";

export type SaveResult = { ok: true; file: string } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads the writer's answer from `unknown`: `{ ok: true, file }` on success, `{ error }` on
 * failure. Anything else (an HTML error page, a proxy answer) becomes a generic failure that
 * carries the HTTP status.
 */
export function parseSaveResponse(status: number, body: unknown): SaveResult {
  if (status >= 200 && status < 300 && isRecord(body) && body.ok === true) {
    if (typeof body.file === "string") return { ok: true, file: body.file };
  }
  if (isRecord(body) && typeof body.error === "string") return { ok: false, error: body.error };
  return { ok: false, error: `Unexpected response from the dev server (HTTP ${status})` };
}

/**
 * Asks the dev server to write `layout` (the diff against the definition on disk) into the
 * `index.ts` of `area`/`slug`. Never throws: network failures come back as `{ ok: false }`.
 */
export async function saveLayoutToSource(
  area: string,
  slug: string,
  layout: LayoutOverrides,
  doFetch: typeof fetch = fetch,
): Promise<SaveResult> {
  let response: Response;
  try {
    response = await doFetch(LAYOUT_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, slug, patch: layout }),
    });
  } catch {
    return { ok: false, error: "Could not reach the dev server" };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return parseSaveResponse(response.status, body);
}
