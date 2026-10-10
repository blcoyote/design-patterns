import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkRequestFacts,
  createLayoutHandler,
  MAX_BODY_BYTES,
  parseJsonBody,
  parseLayoutRequest,
  resolveDefinitionFile,
  type RequestFacts,
} from "./layoutWriter.ts";

const valid = {
  area: "patterns",
  slug: "observer",
  patch: { participants: { subject: { x: 100, y: 200 } }, relations: { notify: { bend: -20 } } },
};

function failure(result: { ok: boolean }) {
  if (result.ok) throw new Error("expected a failure");
  return result as { ok: false; status: number; error: string };
}

describe("parseLayoutRequest", () => {
  it("accepts a well-formed request and returns the narrowed value", () => {
    const result = parseLayoutRequest(valid);
    expect(result).toEqual({ ok: true, value: valid });
  });

  it("accepts the architecture area and a width", () => {
    const result = parseLayoutRequest({
      area: "architecture",
      slug: "cqrs",
      patch: { participants: { a: { width: 160 } }, relations: {} },
    });
    expect(result.ok).toBe(true);
  });

  it("drops undefined fields instead of rejecting them", () => {
    const result = parseLayoutRequest({
      ...valid,
      patch: { participants: { subject: { x: 1, y: undefined } }, relations: {} },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { patch: { participants: { subject: { x: 1 } } } },
    });
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "x"],
    ["a number", 3],
  ])("rejects %s as a body", (_name, body) => {
    expect(failure(parseLayoutRequest(body)).status).toBe(400);
  });

  it("rejects an unknown or missing area", () => {
    expect(parseLayoutRequest({ ...valid, area: "comparisons" }).ok).toBe(false);
    expect(parseLayoutRequest({ ...valid, area: undefined }).ok).toBe(false);
  });

  it.each(["", "Observer", "a_b", "../x", "a/b", "a b", "observer\n", "..", "a.b"])(
    "rejects slug %j",
    (slug) => {
      expect(failure(parseLayoutRequest({ ...valid, slug })).status).toBe(400);
    },
  );

  it("rejects a non-string slug", () => {
    expect(parseLayoutRequest({ ...valid, slug: 7 }).ok).toBe(false);
    expect(parseLayoutRequest({ ...valid, slug: ["observer"] }).ok).toBe(false);
  });

  it("rejects a patch of the wrong shape", () => {
    expect(parseLayoutRequest({ ...valid, patch: null }).ok).toBe(false);
    expect(parseLayoutRequest({ ...valid, patch: { relations: {} } }).ok).toBe(false);
    expect(parseLayoutRequest({ ...valid, patch: { participants: {} } }).ok).toBe(false);
    expect(parseLayoutRequest({ ...valid, patch: { participants: [], relations: {} } }).ok).toBe(
      false,
    );
    expect(
      parseLayoutRequest({ ...valid, patch: { participants: { a: 5 }, relations: {} } }).ok,
    ).toBe(false);
  });

  it.each([
    ["a string", "10"],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["null", null],
    ["an object", {}],
    ["a huge value", 1e9],
  ])("rejects %s as a coordinate", (_name, value) => {
    expect(
      parseLayoutRequest({ ...valid, patch: { participants: { a: { x: value } }, relations: {} } })
        .ok,
    ).toBe(false);
    expect(
      parseLayoutRequest({
        ...valid,
        patch: { participants: {}, relations: { r: { bend: value } } },
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-positive width", () => {
    const body = { ...valid, patch: { participants: { a: { width: 0 } }, relations: {} } };
    expect(parseLayoutRequest(body).ok).toBe(false);
  });

  it("rejects fields that are not layout fields", () => {
    expect(
      parseLayoutRequest({
        ...valid,
        patch: { participants: { a: { label: "x" } }, relations: {} },
      }).ok,
    ).toBe(false);
    expect(
      parseLayoutRequest({ ...valid, patch: { participants: {}, relations: { r: { x: 1 } } } }).ok,
    ).toBe(false);
    // width belongs to participants only
    expect(
      parseLayoutRequest({ ...valid, patch: { participants: {}, relations: { r: { width: 1 } } } })
        .ok,
    ).toBe(false);
  });

  it("rejects odd ids, including prototype keys with punctuation", () => {
    for (const id of ["a b", "a.b", "", "x".repeat(65), "a/b"]) {
      const body = { ...valid, patch: { participants: { [id]: { x: 1 } }, relations: {} } };
      expect(parseLayoutRequest(body).ok).toBe(false);
    }
  });

  it("keeps a __proto__ id as an own key and does not pollute the prototype", () => {
    const body = JSON.parse(
      '{"area":"patterns","slug":"observer","patch":{"participants":{"__proto__":{"x":1}},"relations":{}}}',
    );
    const result = parseLayoutRequest(body);
    expect(result.ok).toBe(true);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    if (result.ok) {
      expect(Object.keys(result.value.patch.participants)).toEqual(["__proto__"]);
    }
  });

  it("rejects a patch that changes nothing", () => {
    expect(
      failure(parseLayoutRequest({ ...valid, patch: { participants: {}, relations: {} } })).error,
    ).toMatch(/nothing/);
    expect(
      parseLayoutRequest({ ...valid, patch: { participants: { a: {} }, relations: {} } }).ok,
    ).toBe(false);
  });

  it("limits how many entries a patch may name", () => {
    const participants = Object.fromEntries(
      Array.from({ length: 501 }, (_, i) => [`p${i}`, { x: i }]),
    );
    expect(parseLayoutRequest({ ...valid, patch: { participants, relations: {} } }).ok).toBe(false);
  });
});

describe("parseJsonBody", () => {
  it("parses JSON", () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects invalid JSON with 400", () => {
    expect(failure(parseJsonBody("{nope")).status).toBe(400);
    expect(failure(parseJsonBody("")).status).toBe(400);
  });

  it("rejects a body over the size limit with 413", () => {
    const big = JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES) });
    expect(failure(parseJsonBody(big)).status).toBe(413);
  });
});

describe("checkRequestFacts", () => {
  const base: RequestFacts = {
    method: "POST",
    host: "localhost:5173",
    origin: undefined,
    secFetchSite: undefined,
    contentType: "application/json",
  };

  it("allows a same-origin browser request", () => {
    expect(
      checkRequestFacts({
        ...base,
        origin: "http://localhost:5173",
        secFetchSite: "same-origin",
      }).ok,
    ).toBe(true);
  });

  it("allows a request with no browser headers (curl) and a charset suffix", () => {
    expect(checkRequestFacts(base).ok).toBe(true);
    expect(checkRequestFacts({ ...base, contentType: "application/json; charset=utf-8" }).ok).toBe(
      true,
    );
    expect(checkRequestFacts({ ...base, secFetchSite: "none" }).ok).toBe(true);
  });

  it.each(["GET", "PUT", "DELETE", "OPTIONS", undefined])("answers %s with 405", (method) => {
    expect(failure(checkRequestFacts({ ...base, method })).status).toBe(405);
  });

  it.each(["cross-site", "same-site"])("refuses Sec-Fetch-Site %s", (secFetchSite) => {
    expect(failure(checkRequestFacts({ ...base, secFetchSite })).status).toBe(403);
  });

  it("refuses an Origin that is not the request's own Host", () => {
    for (const origin of ["http://evil.example", "http://localhost:5174", "null", "garbage"]) {
      expect(failure(checkRequestFacts({ ...base, origin })).status).toBe(403);
    }
  });

  it("requires a JSON content type", () => {
    expect(failure(checkRequestFacts({ ...base, contentType: "text/plain" })).status).toBe(415);
    expect(failure(checkRequestFacts({ ...base, contentType: undefined })).status).toBe(415);
  });
});

describe("resolveDefinitionFile", () => {
  let root: string;
  let outside: string;

  const touch = (...parts: string[]) => {
    const file = join(root, ...parts);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "export const pattern = {};\n");
  };

  beforeAll(() => {
    const base = mkdtempSync(join(tmpdir(), "layout-writer-"));
    root = join(base, "repo");
    outside = join(base, "outside");
    mkdirSync(root);
    mkdirSync(join(outside, "evil"), { recursive: true });
    writeFileSync(join(outside, "evil", "index.ts"), "export const pattern = {};\n");
    touch("src", "patterns", "behavioral", "observer", "index.ts");
    touch("src", "patterns", "creational", "dup", "index.ts");
    touch("src", "patterns", "structural", "dup", "index.ts");
    touch("src", "patterns", "_template", "tmpl", "index.ts");
    touch("src", "architectures", "oo", "hexagonal", "index.ts");
    // a slug folder that is a symlink out of src/
    symlinkSync(join(outside, "evil"), join(root, "src", "patterns", "behavioral", "evil"));
  });

  afterAll(() => rmSync(join(root, ".."), { recursive: true, force: true }));

  it("finds the one matching file in either area", () => {
    const pattern = resolveDefinitionFile(root, "patterns", "observer");
    expect(pattern.ok && pattern.value.endsWith(join("behavioral", "observer", "index.ts"))).toBe(
      true,
    );
    const architecture = resolveDefinitionFile(root, "architecture", "hexagonal");
    expect(
      architecture.ok && architecture.value.endsWith(join("oo", "hexagonal", "index.ts")),
    ).toBe(true);
  });

  it("answers 404 for an unknown slug and for the wrong area", () => {
    expect(failure(resolveDefinitionFile(root, "patterns", "missing")).status).toBe(404);
    expect(failure(resolveDefinitionFile(root, "architecture", "observer")).status).toBe(404);
  });

  it("requires exactly one match", () => {
    expect(failure(resolveDefinitionFile(root, "patterns", "dup")).status).toBe(409);
  });

  it("skips underscore folders such as _template", () => {
    expect(failure(resolveDefinitionFile(root, "patterns", "tmpl")).status).toBe(404);
  });

  it("rejects traversal slugs before touching the filesystem", () => {
    for (const slug of ["../../outside/evil", "..", "a/b", "behavioral/observer", "%2e%2e", ""]) {
      expect(failure(resolveDefinitionFile(root, "patterns", slug)).status).toBe(400);
    }
  });

  it("refuses a folder whose real path leaves src/ (symlinked slug folder)", () => {
    const result = failure(resolveDefinitionFile(root, "patterns", "evil"));
    expect(result.status).toBe(403);
    expect(result.error).toMatch(/outside src/);
  });
});

describe("createLayoutHandler", () => {
  let root: string;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "layout-handler-"));
    mkdirSync(join(root, "src", "patterns", "creational"), { recursive: true });
    mkdirSync(join(root, "src", "architectures"), { recursive: true });
    const handler = createLayoutHandler(root, () => undefined);
    // like Vite's mount at /__dev/layout, the handler sees the URL without that prefix; a 599 means it called next()
    server = createServer((req, res) => handler(req, res, () => res.writeHead(599).end()));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  it("answers a save while another request is stalled mid-body", async () => {
    // Headers promise a body that never arrives: this request waits in readBody() forever.
    const stalled = connect(port, "127.0.0.1");
    stalled.write(
      "POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n" +
        "Content-Length: 200\r\n\r\n{",
    );
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valid),
        signal: AbortSignal.timeout(3000),
      });
      // observer does not exist under the temp root: the handler itself answers 404 (not next())
      expect(response.status).toBe(404);
    } finally {
      stalled.destroy();
    }
  });

  it("rejects non-POST requests without touching the queue", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(405);
  });
});
