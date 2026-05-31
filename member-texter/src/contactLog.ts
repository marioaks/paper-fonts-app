import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { MemberRecord } from "./types.ts";

/**
 * A local, append-only JSON log of who has already been texted. This is what
 * makes re-running safe: a member who already received a message is skipped, so
 * nobody gets double-texted. The file lives on your machine only and is
 * gitignored.
 */
export class ContactLog {
  private records: MemberRecord[] = [];
  private byPhone = new Set<string>();

  private constructor(
    private readonly path: string,
    records: MemberRecord[],
  ) {
    this.records = records;
    for (const r of records) this.byPhone.add(r.phone);
  }

  static async open(path: string): Promise<ContactLog> {
    let records: MemberRecord[] = [];
    try {
      const raw = await readFile(path, "utf8");
      records = JSON.parse(raw) as MemberRecord[];
    } catch {
      records = [];
    }
    return new ContactLog(path, records);
  }

  has(phone: string): boolean {
    return this.byPhone.has(phone);
  }

  /** Count of messages recorded for the current calendar day (local time). */
  countToday(): number {
    const today = new Date().toLocaleDateString();
    return this.records.filter(
      (r) => new Date(r.sentAt).toLocaleDateString() === today,
    ).length;
  }

  async add(record: MemberRecord): Promise<void> {
    this.records.push(record);
    this.byPhone.add(record.phone);
    await this.flush();
  }

  private async flush(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.records, null, 2), "utf8");
  }
}
