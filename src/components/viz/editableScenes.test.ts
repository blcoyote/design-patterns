import { describe, expect, it } from "vitest";

const scenes = import.meta.glob<string>(
  ["/src/patterns/**/Visualization.tsx", "/src/architectures/**/Visualization.tsx"],
  { query: "?raw", import: "default", eager: true },
);

describe("custom scenes", () => {
  it("are found", () => {
    expect(Object.keys(scenes).length).toBeGreaterThan(0);
  });

  // The layout editor can only drag boxes inside a <Diagram> (which renders the edit layer itself)
  // or a scene that renders <DiagramEditLayer> in its own svg.
  it("every Visualization.tsx can be edited in the layout editor", () => {
    const missing = Object.entries(scenes)
      .filter(([, source]) => !/<(Diagram|DiagramEditLayer)[\s>]/.test(source))
      .map(([file]) => file);
    expect(missing).toEqual([]);
  });
});
