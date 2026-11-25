import type { AcceptanceRecord } from "../shared/protocol";
import { JsonStore } from "./storage";
import { PublicError } from "./public-error";

/** Serialize read/modify/write operations; publish only after durable storage succeeds. */
export class AcceptanceStore {
  private records: AcceptanceRecord[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private store: JsonStore<AcceptanceRecord[]>) {}
  async initialize() {
    this.records = await this.store.read();
  }
  list(includeDeleted = false) {
    return structuredClone(
      this.records.filter((record) => includeDeleted || !record.deletedAt),
    );
  }
  private mutate<T>(work: (records: AcceptanceRecord[]) => T): Promise<T> {
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        const next = structuredClone(this.records);
        const result = work(next);
        await this.store.write(next);
        this.records = next;
        return result;
      });
    this.queue = task;
    return task;
  }
  save(record: AcceptanceRecord, expected?: string) {
    return this.mutate((records) => {
      const index = records.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        if (records[index]!.deletedAt)
          throw new PublicError(
            "记录已删除，请先恢复 / Record deleted; restore it first",
          );
        if (records[index]!.updatedAt !== expected)
          throw new PublicError(
            "记录已被修改，请重新打开后编辑 / Record changed; reopen it before editing",
          );
        record.updatedAt = new Date(
          Math.max(Date.now(), Date.parse(expected!) + 1),
        ).toISOString();
        records[index] = record;
      } else {
        if (expected) throw new PublicError("记录不存在 / Record not found");
        records.push(record);
      }
      return structuredClone(record);
    });
  }
  remove(id: string, expected: string) {
    return this.mutate((records) => {
      const record = records.find((item) => item.id === id);
      if (!record || record.deletedAt)
        throw new PublicError("记录不存在 / Record not found");
      if (record.updatedAt !== expected)
        throw new PublicError(
          "记录已被修改，请刷新后删除 / Record changed; refresh before deleting",
        );
      record.deletedAt = new Date().toISOString();
      return structuredClone(record);
    });
  }
  restore(id: string) {
    return this.mutate((records) => {
      const record = records.find((item) => item.id === id);
      if (!record) throw new PublicError("记录不存在 / Record not found");
      delete record.deletedAt;
      return structuredClone(record);
    });
  }
}
