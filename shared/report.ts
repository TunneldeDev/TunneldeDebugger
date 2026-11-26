import type { AcceptanceRecord, SourceIdentity } from "./protocol";

export interface AcceptanceReport {
  version: number;
  generatedAt: string;
  source: SourceIdentity;
  records: AcceptanceRecord[];
  [key: string]: unknown;
}

export interface ExportedReport {
  filename: string;
  path: string;
  downloadUrl: string;
  recordCount: number;
  screenshotCount: number;
  warnings: string[];
}
