// Runs as `preinstall`, before any dependency exists, so it must not import packages.
// Package managers announce themselves in npm_config_user_agent ("pnpm/12.11.2 npm/? node/…").
const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  const used = userAgent.split(" ")[0] || "an unknown package manager";
  console.error(`This repo uses pnpm (pinned via "packageManager" in package.json), not ${used}.`);
  console.error("Run `pnpm install` instead.");
  process.exit(1);
}
