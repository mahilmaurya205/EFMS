import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
const result = spawnSync(process.execPath, [tsc], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit"
});

process.exit(result.status ?? 1);
