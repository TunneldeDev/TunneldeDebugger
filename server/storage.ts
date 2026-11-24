import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SourceIdentity } from "../shared/protocol";
const exec = promisify(execFile);
export class JsonStore<T> {
  private queue: Promise<void> = Promise.resolve();
  constructor(
    readonly path: string,
    private initial: T,
  ) {}
  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return structuredClone(this.initial);
      throw error;
    }
  }
  write(value: T): Promise<void> {
    const bytes = JSON.stringify(value, null, 2);
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = `${this.path}.${randomUUID()}.tmp`;
        await writeFile(temporary, bytes, { mode: 0o600 });
        await rename(temporary, this.path);
      });
    this.queue = task;
    return task;
  }
}
export async function sourceIdentity(target: string): Promise<SourceIdentity> {
  const git = async (...args: string[]) =>
    (
      await exec("git", ["-C", target, ...args], {
        maxBuffer: 32 * 1024 * 1024,
      })
    ).stdout;
  const revision = (await git("rev-parse", "HEAD")).trim();
  const hash = createHash("sha256");
  hash.update(await git("diff", "HEAD", "--binary"));
  for (const file of (
    await git("ls-files", "--others", "--exclude-standard", "-z")
  )
    .split("\0")
    .filter(Boolean)
    .sort()) {
    hash.update(file);
    hash.update(await readFile(join(target, file)));
  }
  return {
    path: target,
    revision,
    dirtyFingerprint: hash.digest("hex"),
    protocol: 1,
  };
}
