import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { chmod, readFile, rename, unlink, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, isAbsolute, sep } from "node:path";
import { format, resolveConfig } from "prettier";
import type { Plugin } from "vite";
import { patchLayout } from "./layoutPatch.ts";
import type { LayoutPatch } from "./types.ts";

/** Where the dev server accepts layout saves. */
export const LAYOUT_ENDPOINT = "/__dev/layout";

/** Largest request body accepted, in bytes. A real patch is a few hundred bytes. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Most participants (and, separately, relations) one patch may name. */
const MAX_ENTRIES = 500;

/** Largest absolute value accepted for a coordinate, width or bend (the viewBox is 800x460). */
const MAX_ABS_VALUE = 100_000;

export type LayoutArea = "patterns" | "architecture";

export interface LayoutSaveRequest {
  area: LayoutArea;
  slug: string;
  patch: LayoutPatch;
}

/** Outcome of a validation step: a value, or the HTTP status and message to answer with. */
export type Checked<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({
  ok: false,
  status,
  error,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SLUG = /^[a-z0-9-]+$/;
/** Participant and relation ids are camelCase or kebab-case words in every definition. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const PARTICIPANT_FIELDS = ["x", "y", "width"] as const;

function checkNumber(value: unknown, where: string): Checked<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(400, `${where} must be a finite number`);
  }
  if (Math.abs(value) > MAX_ABS_VALUE) return fail(400, `${where} is out of range`);
  return { ok: true, value };
}

/**
 * Narrows the parsed JSON body of a save request from `unknown`: only the known shape and fields
 * get through, numbers must be finite and bounded, and the slug may only be `[a-z0-9-]+` (it is
 * later used to look up a folder). Pure; the middleware does I/O, this does the judging.
 */
export function parseLayoutRequest(body: unknown): Checked<LayoutSaveRequest> {
  if (!isRecord(body)) return fail(400, "request body must be a JSON object");
  const { area, slug, patch } = body;
  if (area !== "patterns" && area !== "architecture") {
    return fail(400, 'area must be "patterns" or "architecture"');
  }
  if (typeof slug !== "string" || !SLUG.test(slug)) {
    return fail(400, "slug must match /^[a-z0-9-]+$/");
  }
  if (!isRecord(patch)) return fail(400, "patch must be an object");
  if (!isRecord(patch.participants)) return fail(400, "patch.participants must be an object");
  if (!isRecord(patch.relations)) return fail(400, "patch.relations must be an object");

  const participants: LayoutPatch["participants"] = {};
  const participantEntries = Object.entries(patch.participants);
  const relationEntries = Object.entries(patch.relations);
  if (participantEntries.length > MAX_ENTRIES || relationEntries.length > MAX_ENTRIES) {
    return fail(400, "patch names too many participants or relations");
  }

  for (const [id, fields] of participantEntries) {
    if (!ID.test(id)) return fail(400, `invalid participant id "${id.slice(0, 40)}"`);
    if (!isRecord(fields)) return fail(400, `participants.${id} must be an object`);
    const out: LayoutPatch["participants"][string] = {};
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      if (!(PARTICIPANT_FIELDS as readonly string[]).includes(field)) {
        return fail(400, `participants.${id}: unknown field "${field.slice(0, 40)}"`);
      }
      const checked = checkNumber(value, `participants.${id}.${field}`);
      if (!checked.ok) return checked;
      if (field === "width" && checked.value <= 0) {
        return fail(400, `participants.${id}.width must be positive`);
      }
      if (field === "x") out.x = checked.value;
      else if (field === "y") out.y = checked.value;
      else out.width = checked.value;
    }
    // Object.fromEntries-style definition: an own "__proto__" key stays an ordinary property
    Object.defineProperty(participants, id, {
      value: out,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  const relations: LayoutPatch["relations"] = {};
  for (const [id, fields] of relationEntries) {
    if (!ID.test(id)) return fail(400, `invalid relation id "${id.slice(0, 40)}"`);
    if (!isRecord(fields)) return fail(400, `relations.${id} must be an object`);
    const out: LayoutPatch["relations"][string] = {};
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      if (field !== "bend") {
        return fail(400, `relations.${id}: unknown field "${field.slice(0, 40)}"`);
      }
      const checked = checkNumber(value, `relations.${id}.bend`);
      if (!checked.ok) return checked;
      out.bend = checked.value;
    }
    Object.defineProperty(relations, id, {
      value: out,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  const touched = (record: Record<string, object>) =>
    Object.values(record).some((fields) => Object.keys(fields).length > 0);
  if (!touched(participants) && !touched(relations)) return fail(400, "patch changes nothing");

  return { ok: true, value: { area, slug, patch: { participants, relations } } };
}

/** The parts of an HTTP request the gate looks at, as plain strings. */
export interface RequestFacts {
  method: string | undefined;
  /** `Host` header of the request: the address the dev server was reached at. */
  host: string | undefined;
  origin: string | undefined;
  secFetchSite: string | undefined;
  contentType: string | undefined;
}

/**
 * Decides whether a request may even be read: POST only, JSON only, and never from another
 * site. `Sec-Fetch-Site` (sent by every current browser) must be `same-origin` or `none`; when an
 * `Origin` header is present its host must equal the request's own `Host`. A request with
 * neither header (curl, scripts) is allowed: it is not a browser acting on someone else's behalf.
 */
export function checkRequestFacts(facts: RequestFacts): Checked<void> {
  if (facts.method !== "POST") return fail(405, "method not allowed: use POST");
  const site = facts.secFetchSite;
  if (site !== undefined && site !== "same-origin" && site !== "none") {
    return fail(403, "cross-site request refused");
  }
  if (facts.origin !== undefined) {
    let originHost: string | null = null;
    try {
      originHost = new URL(facts.origin).host;
    } catch {
      // "null" or garbage: treated as foreign below
    }
    if (originHost === null || originHost !== facts.host) {
      return fail(403, "cross-origin request refused");
    }
  }
  const type = (facts.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return fail(415, "content-type must be application/json");
  return { ok: true, value: undefined };
}

/** Parses request body text: size-limited, then JSON. The result is still `unknown`. */
export function parseJsonBody(text: string): Checked<unknown> {
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return fail(413, "request body too large");
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return fail(400, "request body is not valid JSON");
  }
}

const AREA_DIRS: Record<LayoutArea, string> = {
  patterns: "src/patterns",
  architecture: "src/architectures",
};

/**
 * Finds `<root>/src/patterns/<category>/<slug>/index.ts` (or the architectures equivalent) by
 * scanning the category folders, and returns its real path. Exactly one match is required, the
 * slug is re-checked here so the helper is safe on its own, and the real path (symlinks
 * resolved) must stay inside `<root>/src`.
 */
export function resolveDefinitionFile(
  root: string,
  area: LayoutArea,
  slug: string,
): Checked<string> {
  if (!SLUG.test(slug)) return fail(400, "slug must match /^[a-z0-9-]+$/");
  const areaDir = join(root, AREA_DIRS[area]);

  let groups: string[];
  try {
    groups = readdirSync(areaDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
      .map((entry) => entry.name);
  } catch {
    return fail(500, `cannot read ${AREA_DIRS[area]}`);
  }

  const matches = groups
    .map((group) => join(areaDir, group, slug, "index.ts"))
    .filter((candidate) => existsSync(candidate));
  if (matches.length === 0) return fail(404, `no ${area} definition with slug "${slug}"`);
  if (matches.length > 1) return fail(409, `slug "${slug}" matches more than one folder`);

  let real: string;
  let realSrc: string;
  try {
    real = realpathSync(matches[0]);
    realSrc = realpathSync(join(root, "src"));
  } catch {
    return fail(500, "cannot resolve the definition file");
  }
  const rel = relative(realSrc, real);
  if (rel === "" || rel.startsWith(".." + sep) || rel === ".." || isAbsolute(rel)) {
    return fail(403, "resolved path is outside src/");
  }
  if (!statSync(real).isFile()) return fail(404, "definition is not a regular file");
  return { ok: true, value: real };
}

/** Writes `text` to `file` by writing a sibling temp file and renaming it over the target. */
async function writeAtomic(file: string, text: string): Promise<void> {
  const mode = statSync(file).mode & 0o777;
  const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(temp, text, { encoding: "utf8", flag: "wx", mode });
    await chmod(temp, mode);
    await rename(temp, file);
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}

/** Patches and formats one definition file. Throws patchLayout's descriptive error on mismatch. */
async function patchFile(file: string, patch: LayoutPatch): Promise<boolean> {
  const source = await readFile(file, "utf8");
  const patched = patchLayout(source, patch);
  if (patched === source) return false;
  const options = (await resolveConfig(file)) ?? {};
  const formatted = await format(patched, { ...options, filepath: file });
  if (formatted === source) return false;
  await writeAtomic(file, formatted);
  return true;
}

function readBody(req: IncomingMessage): Promise<Checked<string>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (result: Checked<string>) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        finish(fail(413, "request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finish({ ok: true, value: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", () => finish(fail(400, "could not read the request body")));
  });
}

function respond(res: ServerResponse, status: number, body: object): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * Dev-server only (`apply: "serve"`): `POST /__dev/layout` with `{ area, slug, patch }` rewrites
 * the layout literals in that pattern's or architecture's `index.ts` (see `patchLayout`),
 * prettier-formats the result with the repo config and writes it atomically. Vite's own file
 * watcher then hot-updates the page. Not part of `vite build` or `vite preview`.
 */
export function layoutWriterPlugin(): Plugin {
  // Saves are applied one at a time, so two quick requests can't interleave read and write.
  let queue: Promise<unknown> = Promise.resolve();

  return {
    name: "layout-writer",
    apply: "serve",
    configureServer(server) {
      const root = server.config.root;
      server.middlewares.use(LAYOUT_ENDPOINT, (req, res, next) => {
        if (req.url !== undefined && req.url !== "/" && !req.url.startsWith("/?")) {
          next();
          return;
        }
        const run = async () => {
          const gate = checkRequestFacts({
            method: req.method,
            host: header(req, "host"),
            origin: header(req, "origin"),
            secFetchSite: header(req, "sec-fetch-site"),
            contentType: header(req, "content-type"),
          });
          if (!gate.ok) return respond(res, gate.status, { error: gate.error });

          const text = await readBody(req);
          if (!text.ok) return respond(res, text.status, { error: text.error });
          const json = parseJsonBody(text.value);
          if (!json.ok) return respond(res, json.status, { error: json.error });
          const request = parseLayoutRequest(json.value);
          if (!request.ok) return respond(res, request.status, { error: request.error });

          const { area, slug, patch } = request.value;
          const file = resolveDefinitionFile(root, area, slug);
          if (!file.ok) return respond(res, file.status, { error: file.error });

          const repoFile = relative(root, file.value).split(sep).join("/");
          try {
            await patchFile(file.value, patch);
          } catch (error) {
            // patchLayout throws "layout patch: …" for anything it cannot place; anything else
            // (I/O, prettier) is a server problem
            const message = error instanceof Error ? error.message : String(error);
            if (message.startsWith("layout patch:")) return respond(res, 422, { error: message });
            server.config.logger.error(`[layout-writer] ${repoFile}: ${message}`);
            return respond(res, 500, { error: `could not write ${repoFile}: ${message}` });
          }
          respond(res, 200, { ok: true, file: repoFile });
        };
        const job = queue.then(run, run);
        queue = job.catch(() => undefined);
        job.catch((error: unknown) => {
          server.config.logger.error(`[layout-writer] ${String(error)}`);
          if (!res.headersSent) respond(res, 500, { error: "internal error" });
        });
      });
    },
  };
}
