import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { finished } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { JsonStore, sourceIdentity } from "./storage";
import { Runner, collapseSelection } from "./runners";
import { PublicError } from "./public-error";
import type {
  RunEvent,
  TestItem,
  TestRun,
  RunStatus,
  TestRunnerAdapter,
  RunnerKind,
} from "../shared/protocol";
export class Scheduler {
  runs: TestRun[] = [];
  private active = false;
  private controllers = new Map<string, AbortController>();
  private store: JsonStore<TestRun[]>;
  constructor(
    readonly target: string,
    private data: string,
    private changed: () => void,
    private adapter?: (kind: RunnerKind) => TestRunnerAdapter,
  ) {
    this.store = new JsonStore(join(data, "runs.json"), []);
  }
  async initialize() {
    await mkdir(join(this.data, "logs"), { recursive: true });
    this.runs = await this.store.read();
    for (const run of this.runs)
      if (["running", "queued"].includes(run.status)) {
        run.status = "interrupted";
        run.finishedAt = new Date().toISOString();
      }
    await this.save();
  }
  private save() {
    return this.store.write(this.runs.slice(-200));
  }
  async enqueue(items: TestItem[]) {
    const run: TestRun = {
      id: randomUUID(),
      items: collapseSelection(items),
      source: await sourceIdentity(this.target),
      createdAt: new Date().toISOString(),
      status: "queued",
      events: [],
    };
    if (!run.items.length) throw new PublicError("No tests selected");
    this.runs.push(run);
    await this.save();
    this.changed();
    void this.pump();
    return run;
  }
  get nativeBusy() {
    return this.runs.some(
      (run) =>
        ["queued", "running"].includes(run.status) &&
        run.items.some((item) => item.runner === "native"),
    );
  }
  async cancel(id: string) {
    const run = this.runs.find((item) => item.id === id);
    if (!run) throw new PublicError("Unknown run");
    if (run.status === "queued") {
      run.status = "cancelled";
      run.finishedAt = new Date().toISOString();
      await this.save();
      this.changed();
    } else this.controllers.get(id)?.abort();
  }
  private async pump() {
    if (this.active) return;
    this.active = true;
    try {
      for (const run of this.runs) {
        if (run.status !== "queued") continue;
        const controller = new AbortController();
        this.controllers.set(run.id, controller);
        run.status = "running";
        await this.save();
        this.changed();
        run.eventLog = `${run.id}.jsonl`;
        run.results = {};
        const journal = createWriteStream(
          join(this.data, "logs", run.eventLog),
          { mode: 0o600 },
        );
        const journalDone = finished(journal).then(
          () => undefined,
          (error) => error as Error,
        );
        let sequence = 0;
        const emit = (event: Omit<RunEvent, "sequence" | "time">) => {
          const row = {
            ...event,
            sequence: ++sequence,
            time: new Date().toISOString(),
          };
          run.events.push(row);
          journal.write(JSON.stringify(row) + "\n");
          if (row.type === "case" && row.itemId) run.results![row.itemId] = row;
          if (run.events.length > 4000) run.events.splice(0, 1000);
          this.changed();
          if (sequence % 25 === 0) void this.save();
        };
        try {
          let result: RunStatus = "passed";
          for (const kind of [
            ...new Set(run.items.map((item) => item.runner)),
          ]) {
            const status = await (
              this.adapter?.(kind) ?? new Runner(kind, this.target)
            ).run(
              run.items.filter((item) => item.runner === kind),
              controller.signal,
              emit,
            );
            if (status === "cancelled") {
              result = status;
              break;
            }
            if (status === "failed") result = status;
          }
          run.status = result;
        } catch (error) {
          run.status = controller.signal.aborted ? "cancelled" : "failed";
          emit({ type: "log", text: String(error) });
        }
        journal.end();
        const journalError = await journalDone;
        if (journalError) {
          run.status = "failed";
          run.events.push({
            type: "log",
            sequence: ++sequence,
            time: new Date().toISOString(),
            text: `Event journal failed: ${journalError.message}`,
          });
        }
        run.finishedAt = new Date().toISOString();
        this.controllers.delete(run.id);
        await this.save();
        this.changed();
      }
    } finally {
      this.active = false;
    }
  }
  async dispose() {
    for (const controller of this.controllers.values()) controller.abort();
    const deadline = Date.now() + 5000;
    while (this.active && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    await this.save();
  }
}
