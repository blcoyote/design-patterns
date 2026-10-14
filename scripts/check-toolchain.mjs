// Runs as `preinstall`, before any dependency exists, so it must not import packages (node: builtins are fine).
// Package managers announce themselves in npm_config_user_agent ("pnpm/12.11.2 npm/? node/…").
// pnpm 12 ignores the root "engines" field, so the Node requirement is checked here too:
// an older Node only warns, a package manager other than pnpm fails the install.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function checkToolchain({ userAgent, nodeVersion, enginesNode }) {
  const errors = [];
  const warnings = [];

  if (!(userAgent ?? "").startsWith("pnpm/")) {
    const used = (userAgent ?? "").split(" ")[0] || "an unknown package manager";
    errors.push(`This repo uses pnpm (pinned via "packageManager" in package.json), not ${used}.`);
    errors.push("Run `pnpm install` instead.");
  }

  // Only ">=N" (optionally ">=N.x.y") is understood; any other range is skipped rather than guessed.
  // Every component is compared, with "x" or a missing component counting as 0.
  const required = /^>=(\d+(?:\.[\dx]+){0,2})$/.exec(enginesNode ?? "");
  if (required && isOlder(nodeVersion, required[1])) {
    warnings.push(
      `This repo expects Node ${enginesNode} (engines.node in package.json), but this is Node ${nodeVersion}. Run \`nvm use\` to pick up the version pinned in .nvmrc.`,
    );
  }

  return { errors, warnings };
}

function isOlder(version, floor) {
  const parts = (value) => [0, 1, 2].map((i) => Number.parseInt(value.split(".")[i], 10) || 0);
  const have = parts(version);
  const need = parts(floor);
  const differs = have.findIndex((part, i) => part !== need[i]);
  return differs !== -1 && have[differs] < need[differs];
}

// import.meta.url is already a realpath; argv[1] is not, so resolve it before comparing
// (a checkout under a symlinked directory would otherwise skip the check silently).
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { engines } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const { errors, warnings } = checkToolchain({
    userAgent: process.env.npm_config_user_agent,
    nodeVersion: process.versions.node,
    enginesNode: engines?.node,
  });
  for (const warning of warnings) console.warn(warning);
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exit(1);
}
