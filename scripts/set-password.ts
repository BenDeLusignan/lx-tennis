/**
 * Set or reset a reviewer's password:
 *
 *   npm run db:set-password -- ben
 *
 * Prompts twice without echoing, so the password never appears on screen or
 * in shell history. Piped input (one line, then the same line again) also
 * works, for scripted setups. Setting a new password logs that reviewer out
 * of every device (see src/auth/session.ts).
 *
 * It only updates existing reviewers: adding accounts is an open question
 * in docs/vision.md.
 */
import { createInterface } from "node:readline";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "@/auth/password";
import {
  getReviewerCredentialsByUsername,
  getReviewerUsernames,
  setReviewerPasswordHash,
} from "@/data/reviewers";

// Same .env files as the app, so this writes to the database the app reads.
loadEnvConfig(process.cwd());

const MIN_LENGTH = 12;

// Reads one line from stdin. On a terminal, echo is off and keys are
// handled by hand; otherwise it's piped input.
async function readSecretLine(prompt: string, lines: AsyncIterator<string> | null): Promise<string> {
  process.stdout.write(prompt);
  if (lines) {
    const { value, done } = await lines.next();
    process.stdout.write("\n");
    if (done) throw new Error("Not enough input: expected the password twice, one per line.");
    return value;
  }

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  let value = "";
  // A 'data' listener rather than `for await (… of stdin)`: leaving that loop
  // early destroys stdin, so the second prompt could never read. Executor
  // form because Node 20 has no Promise.withResolvers.
  return new Promise((resolve) => {
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003" || char === "\u0004") {
          // Ctrl+C / Ctrl+D: raw mode swallows both, so cancel by hand.
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
    stdin.resume();
  });
}

async function main() {
  const reviewer = process.argv[2] ? await getReviewerCredentialsByUsername(process.argv[2]) : undefined;
  if (!reviewer) {
    const usernames = await getReviewerUsernames();
    const known = usernames.length > 0 ? usernames.join(", ") : "none (run npm run db:migrate first)";
    console.error(`Usage: npm run db:set-password -- <username>\nReviewers: ${known}`);
    process.exit(1);
  }
  const { username } = reviewer;

  const lines = process.stdin.isTTY
    ? null
    : createInterface({ input: process.stdin, terminal: false })[Symbol.asyncIterator]();
  const password = await readSecretLine(`New password for ${username}: `, lines);
  if (password.length < MIN_LENGTH) {
    console.error(`Use at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }
  if ((await readSecretLine("Same password again: ", lines)) !== password) {
    console.error("The two entries don't match. Nothing changed.");
    process.exit(1);
  }

  await setReviewerPasswordHash(username, await hashPassword(password));
  console.log(`Password set for ${username}. Their existing sessions are now logged out.`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
