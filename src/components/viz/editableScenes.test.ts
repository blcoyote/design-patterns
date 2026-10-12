import { parseAst } from "vite";
import { describe, expect, it } from "vitest";

const scenes = import.meta.glob<string>(
  ["/src/patterns/**/Visualization.tsx", "/src/architectures/**/Visualization.tsx"],
  { query: "?raw", import: "default", eager: true },
);

/** Components that let the layout editor drag a scene's boxes. */
const EDITABLE = new Set(["Diagram", "DiagramEditLayer"]);

/** Names of every JSX element rendered in `source` (parsed, so comments and strings never count). */
function jsxElementNames(source: string): Set<string> {
  const names = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== "object" || node === null) return;
    if ("type" in node && node.type === "JSXOpeningElement" && "name" in node) {
      const name = node.name;
      if (typeof name === "object" && name !== null && "name" in name) {
        if (typeof name.name === "string") names.add(name.name);
      }
    }
    Object.values(node).forEach(visit);
  };
  visit(parseAst(source, { lang: "tsx" }));
  return names;
}

describe("custom scenes", () => {
  it("are found", () => {
    expect(Object.keys(scenes).length).toBeGreaterThan(0);
  });

  it("only count rendered elements, not comments or strings", () => {
    const source = `// <Diagram> in a comment
      const label = "<DiagramEditLayer>";
      export const Scene = () => <svg><Diagram participants={[]} /></svg>;`;
    expect([...jsxElementNames(source)].filter((n) => EDITABLE.has(n))).toEqual(["Diagram"]);
    expect(jsxElementNames(`// <Diagram>\nconst s = "<DiagramEditLayer>";`).size).toBe(0);
  });

  // The layout editor can only drag boxes inside a <Diagram> (which renders the edit layer itself)
  // or a scene that renders <DiagramEditLayer> in its own svg.
  it("every Visualization.tsx can be edited in the layout editor", () => {
    const missing = Object.entries(scenes)
      .filter(([, source]) => ![...jsxElementNames(source)].some((n) => EDITABLE.has(n)))
      .map(([file]) => file);
    expect(missing).toEqual([]);
  });
});
