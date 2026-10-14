import { describe, expect, it } from "vitest";
import { checkToolchain } from "./check-toolchain.mjs";

const pnpmAgent = "pnpm/12.11.2 npm/? node/v26.11.1 darwin arm64";

describe("checkToolchain", () => {
  it("accepts pnpm on a supported Node", () => {
    expect(
      checkToolchain({ userAgent: pnpmAgent, nodeVersion: "26.11.1", enginesNode: ">=26" }),
    ).toEqual({ errors: [], warnings: [] });
  });

  it.each([
    ["npm/11.6.0 node/v26.11.1 darwin arm64", "npm/11.6.0"],
    ["yarn/4.5.0 npm/? node/v26.11.1 darwin arm64", "yarn/4.5.0"],
    ["", "an unknown package manager"],
    [undefined, "an unknown package manager"],
  ])("rejects %j as the package manager", (userAgent, used) => {
    const { errors } = checkToolchain({ userAgent, nodeVersion: "26.11.1", enginesNode: ">=26" });
    expect(errors).toEqual([
      `This repo uses pnpm (pinned via "packageManager" in package.json), not ${used}.`,
      "Run `pnpm install` instead.",
    ]);
  });

  it("warns, but does not fail, on a Node older than engines.node", () => {
    const { errors, warnings } = checkToolchain({
      userAgent: pnpmAgent,
      nodeVersion: "24.21.0",
      enginesNode: ">=26",
    });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("24.21.0");
    expect(warnings[0]).toContain(">=26");
    expect(warnings[0]).toContain(".nvmrc");
    expect(warnings[0]).toContain("nvm use");
  });

  it.each(["26.0.0", "26.11.1", "27.1.0"])("does not warn on Node %s with >=26", (nodeVersion) => {
    expect(checkToolchain({ userAgent: pnpmAgent, nodeVersion, enginesNode: ">=26" })).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it.each([">=26.1.0", ">=26.x"])("reads the major from %s", (enginesNode) => {
    expect(
      checkToolchain({ userAgent: pnpmAgent, nodeVersion: "24.21.0", enginesNode }).warnings,
    ).toHaveLength(1);
  });

  it.each([
    ["26.0.0", ">=26.1.0"],
    ["26.1.0", ">=26.1.1"],
    ["26.11.1", ">=26.12"],
  ])("warns on Node %s below the same-major floor %s", (nodeVersion, enginesNode) => {
    expect(
      checkToolchain({ userAgent: pnpmAgent, nodeVersion, enginesNode }).warnings,
    ).toHaveLength(1);
  });

  it.each([
    ["26.1.0", ">=26.1.0"],
    ["26.2.0", ">=26.1.5"],
    ["26.11.1", ">=26.x"],
    ["27.0.0", ">=26.12.3"],
  ])("does not warn on Node %s with %s", (nodeVersion, enginesNode) => {
    expect(checkToolchain({ userAgent: pnpmAgent, nodeVersion, enginesNode }).warnings).toEqual([]);
  });

  it.each([undefined, "^26", "26", ">=26 <28", ">26"])(
    "skips the Node check for engines.node %j",
    (enginesNode) => {
      expect(checkToolchain({ userAgent: pnpmAgent, nodeVersion: "24.21.0", enginesNode })).toEqual(
        {
          errors: [],
          warnings: [],
        },
      );
    },
  );
});
