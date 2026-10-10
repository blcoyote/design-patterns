import { describe, expect, it } from "vitest";
import { describeChanges } from "./layoutChanges";

const def = {
  participants: [
    { id: "subject", label: "S", role: "S", description: "", x: 100, y: 70 },
    { id: "observer", label: "O", role: "O", description: "", x: 400, y: 70, width: 180 },
  ],
  relations: [
    { id: "attach", from: "observer", to: "subject", type: "calls" as const, description: "" },
    {
      id: "notify",
      from: "subject",
      to: "observer",
      type: "calls" as const,
      description: "",
      bend: 10,
    },
  ],
};

describe("describeChanges", () => {
  it("describes participant and relation changes in definition order", () => {
    const rows = describeChanges(def, {
      participants: { observer: { x: 420, y: 90, width: 200 }, subject: { y: 80 } },
      relations: { notify: { bend: 30 }, attach: { bend: -20 } },
    });
    expect(rows.map((r) => r.text)).toEqual([
      "participant subject: y 70 -> 80",
      "participant observer: x 400 -> 420, y 70 -> 90, width 180 -> 200",
      "relation attach: bend 0 -> -20",
      "relation notify: bend 10 -> 30",
    ]);
    expect(rows[1]).toMatchObject({ kind: "participant", id: "observer" });
    expect(rows[3]).toMatchObject({ kind: "relation", id: "notify" });
  });

  it("skips unknown ids and empty patches", () => {
    expect(
      describeChanges(def, { participants: { nope: { x: 1 }, subject: {} }, relations: {} }),
    ).toEqual([]);
  });
});
