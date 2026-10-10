import { describe, expect, it } from "vitest";
import { emptyLayout } from "./layoutEdit";
import { parseSaveResponse, saveLayoutToSource } from "./layoutSave";

const layout = {
  participants: { subject: { x: 100, y: 200 } },
  relations: { notify: { bend: 20 } },
};

function fakeFetch(status: number, body: string) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const impl: typeof fetch = (input, init) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(new Response(body, { status }));
  };
  return { impl, calls };
}

describe("parseSaveResponse", () => {
  it("reads a success", () => {
    expect(parseSaveResponse(200, { ok: true, file: "src/a/index.ts" })).toEqual({
      ok: true,
      file: "src/a/index.ts",
    });
  });

  it("passes the server's error message through", () => {
    expect(parseSaveResponse(422, { error: 'layout patch: no participant with id "x"' })).toEqual({
      ok: false,
      error: 'layout patch: no participant with id "x"',
    });
  });

  it("does not trust a 2xx without the expected shape", () => {
    for (const body of [null, undefined, "ok", [], { ok: true }, { ok: true, file: 3 }]) {
      const result = parseSaveResponse(200, body);
      expect(result.ok).toBe(false);
    }
  });

  it("falls back to a generic message carrying the status", () => {
    expect(parseSaveResponse(502, undefined)).toEqual({
      ok: false,
      error: "Unexpected response from the dev server (HTTP 502)",
    });
  });
});

describe("saveLayoutToSource", () => {
  it("POSTs area, slug and patch as JSON", async () => {
    const { impl, calls } = fakeFetch(200, JSON.stringify({ ok: true, file: "src/x/index.ts" }));
    const result = await saveLayoutToSource("patterns", "observer", layout, impl);
    expect(result).toEqual({ ok: true, file: "src/x/index.ts" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/__dev/layout");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      area: "patterns",
      slug: "observer",
      patch: layout,
    });
  });

  it("returns the server's message on a 4xx", async () => {
    const { impl } = fakeFetch(400, JSON.stringify({ error: "patch changes nothing" }));
    expect(await saveLayoutToSource("patterns", "observer", emptyLayout(), impl)).toEqual({
      ok: false,
      error: "patch changes nothing",
    });
  });

  it("survives a non-JSON body and a network failure", async () => {
    const html = fakeFetch(500, "<html>boom</html>");
    expect((await saveLayoutToSource("patterns", "observer", layout, html.impl)).ok).toBe(false);
    const down: typeof fetch = () => Promise.reject(new TypeError("failed"));
    expect(await saveLayoutToSource("patterns", "observer", layout, down)).toEqual({
      ok: false,
      error: "Could not reach the dev server",
    });
  });
});
