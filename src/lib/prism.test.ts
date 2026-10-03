import { describe, expect, it } from "vitest";

describe("prism C# registration", () => {
  it("registers the csharp grammar on the shared Prism instance", async () => {
    const { Prism } = await import("./prism");
    expect(Prism.languages.csharp).toBeTruthy();
    expect(Prism.languages.cs).toBe(Prism.languages.csharp);
  });

  it("has the python grammar available", async () => {
    const { Prism } = await import("./prism");
    expect(Prism.languages.python).toBeTruthy();
  });

  it("has the go grammar available", async () => {
    const { Prism } = await import("./prism");
    expect(Prism.languages.go).toBeTruthy();
  });
});
