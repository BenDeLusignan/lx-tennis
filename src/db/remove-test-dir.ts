import { rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import v8 from "node:v8";
import vm from "node:vm";

/** Collections tried before giving up; in practice one or two are enough. */
const MAX_COLLECTIONS = 20;

/**
 * For tests only: removes a temp directory that held libsql database files,
 * after the test closed every client on them.
 *
 * On Windows `client.close()` isn't enough: libsql (0.5.x) only releases its
 * native handle on the file when the garbage collector finalizes it, so
 * `rmSync` throws EPERM until then. (POSIX lets you delete an open file, so it
 * never showed up there.) So this collects garbage and yields to let the
 * finalizers run, and tries the removal after each round. Finalizers run in a
 * later turn than the collection and not always the first, hence the loop. A
 * directory that's still locked after all rounds throws: most likely a client
 * the test left open and still holds on to, which the collector can't free.
 *
 * `gc` isn't exposed in a normal run, so it's switched on here rather than by
 * a `node` flag that every way of running the tests would have to remember.
 *
 * Delete this file once libsql releases the file in `close()`: callers can go
 * back to a plain `rmSync(dir, { recursive: true, force: true })`.
 */
export async function removeTestDir(dir: string): Promise<void> {
  v8.setFlagsFromString("--expose-gc");
  const gc = vm.runInNewContext("gc") as () => void;
  for (let round = 1; ; round++) {
    gc();
    await delay(0);
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (round >= MAX_COLLECTIONS || (error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }
  }
}
