#!/usr/bin/env node
/**
 * Invariants that types cannot express and review keeps missing.
 *
 * Each rule here previously existed only as a code comment. A comment does not
 * survive the next person in a hurry — Phase 8's final review made exactly that
 * point about A17, which is why this file exists.
 *
 * Run: `pnpm check:invariants`
 */
import { readFileSync, globSync } from "node:fs";

const ROOTS = ["apps/web/src", "packages/shared/src", "packages/db/src"];
const files = ROOTS.flatMap((root) => globSync(`${root}/**/*.{ts,tsx}`)).filter(
  (f) => !f.includes("node_modules"),
);

const failures = [];

/**
 * A17 — accepting a collab request is two writes (the status change and the
 * `project_collaborators` credit row) and must stay atomic. The guard trigger
 * permits the project author to set `status = 'accepted'` directly, so a plain
 * PATCH *succeeds* — and silently produces an accepted request with no credit
 * behind it. The `accept_collab_request` RPC is the only correct path.
 */
const ACCEPT_RPC_ALLOWED = new Set(["packages/shared/src/collab.ts"]);

for (const file of files) {
  const rel = file.split("\\").join("/");
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, i) => {
    const isComment = /^\s*(\*|\/\/)/.test(line);

    // A direct `status: "accepted"` write on collab_requests — detected by the
    // table being named in the surrounding chain, since `project_collaborators`
    // legitimately carries the same literal.
    if (!isComment && /status:\s*["']accepted["']/.test(line)) {
      const near = lines.slice(Math.max(0, i - 6), i + 7).join("\n");
      if (/from\(\s*["']collab_requests["']\s*\)/.test(near)) {
        failures.push(
          `${rel}:${i + 1}  writes status:"accepted" on collab_requests directly.\n` +
            `      Use acceptCollabRequest (the accept_collab_request RPC) — a direct\n` +
            `      update succeeds but leaves no project_collaborators credit row.`,
        );
      }
    }

    // The RPC stays behind its single wrapper, so the rule has exactly one
    // place left to be enforced.
    if (!isComment && /rpc\(\s*["']accept_collab_request["']/.test(line) && !ACCEPT_RPC_ALLOWED.has(rel)) {
      failures.push(
        `${rel}:${i + 1}  calls accept_collab_request directly.\n` +
          `      Go through acceptCollabRequest in packages/shared/src/collab.ts.`,
      );
    }
  });
}

if (failures.length > 0) {
  console.error(`\ncheck-invariants: ${failures.length} violation(s)\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check-invariants: OK (${files.length} files scanned)`);
