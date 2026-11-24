export const PROTOCOL_VERSION = 1 as const;
export type TargetKind = "browser" | "native-mock" | "native-service";
export type Preset =
  "normal" | "empty" | "loading" | "error" | "boundary" | "disabled";
export interface ScenarioParameters {
  preset: Preset;
  theme: "dark" | "light";
  locale: "zh-CN" | "en-US";
  width: number;
  height: number;
  count: number;
  seed: number;
}
export const DEFAULT_PARAMETERS: ScenarioParameters = {
  preset: "normal",
  theme: "dark",
  locale: "zh-CN",
  width: 1280,
  height: 800,
  count: 24,
  seed: 42,
};
export interface ScenarioDefinition {
  id: string;
  surface: string;
  category: string;
  title: string;
  titleEn: string;
  targets: TargetKind[];
  presets: Preset[];
  checklist: string[];
  prepareSteps: string[];
  interactionTests: string[];
  limitation?: string;
  unsupportedPresets?: Partial<Record<Preset, string>>;
}
export interface SourceIdentity {
  path: string;
  revision: string;
  dirtyFingerprint: string;
  protocol: number;
}
export interface DebugTarget {
  describe(): Promise<{
    protocol: number;
    targets: TargetKind[];
    source: SourceIdentity;
  }>;
  prepare(
    scenario: ScenarioDefinition,
    parameters: ScenarioParameters,
  ): Promise<void>;
  apply(generation: number): Promise<void>;
  snapshot(): Promise<unknown>;
  reset(): Promise<void>;
  dispose(): Promise<void>;
}
export type RunnerKind = "vitest" | "rust" | "node" | "playwright" | "native";
export interface TestItem {
  id: string;
  runner: RunnerKind;
  label: string;
  file?: string;
  name?: string;
  target?: string;
  children?: TestItem[];
  unavailable?: string;
  ignored?: boolean;
}
export type RunStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "skipped";
export interface RunEvent {
  sequence: number;
  time: string;
  type: "log" | "case" | "status" | "artifact";
  text?: string;
  itemId?: string;
  status?: RunStatus;
  duration?: number;
  artifact?: string;
}
export interface TestRun {
  results?: Record<string, RunEvent>;
  eventLog?: string;
  id: string;
  items: TestItem[];
  source: SourceIdentity;
  createdAt: string;
  finishedAt?: string;
  status: RunStatus;
  events: RunEvent[];
}
export interface TestRunnerAdapter {
  kind: RunnerKind;
  discover(): Promise<TestItem[]>;
  run(
    items: TestItem[],
    signal: AbortSignal,
    emit: (event: Omit<RunEvent, "sequence" | "time">) => void,
  ): Promise<RunStatus>;
}
export interface AcceptanceRecord {
  id: string;
  scenarioId: string;
  target: TargetKind;
  parameters: ScenarioParameters;
  source: SourceIdentity;
  status: "pending" | "passed" | "failed" | "blocked";
  note: string;
  screenshots: string[];
  checklist?: string[];
  updatedAt: string;
  generation?: number;
}
export interface NativeState {
  state: "stopped" | "starting" | "ready" | "applying" | "failed";
  pid?: number;
  runId?: string;
  mode?: TargetKind;
  scenarioId?: string;
  generation: number;
  error?: string;
  profile?: string;
  capabilities?: unknown;
  parameters?: ScenarioParameters;
  source?: SourceIdentity;
}
export type FrameMessage = {
  version: 1;
  session: string;
  generation: number;
} & (
  | {
      type: "apply";
      scenario: ScenarioDefinition;
      parameters: ScenarioParameters;
    }
  | { type: "ready"; scenarioId: string }
  | { type: "error"; message: string }
  | { type: "diagnostic"; message: string }
  | { type: "snapshot" }
  | { type: "state"; snapshot: unknown }
);
export function validateParameters(input: unknown): ScenarioParameters {
  if (!input || typeof input !== "object")
    throw new Error("Invalid scenario parameters");
  const p = input as ScenarioParameters;
  if (
    !["normal", "empty", "loading", "error", "boundary", "disabled"].includes(
      p.preset,
    ) ||
    !["dark", "light"].includes(p.theme) ||
    !["zh-CN", "en-US"].includes(p.locale)
  )
    throw new Error("Invalid scenario variant");
  for (const [key, min, max] of [
    ["width", 280, 3840],
    ["height", 200, 2160],
    ["count", 0, 10000],
    ["seed", 0, 2147483647],
  ] as const) {
    if (!Number.isSafeInteger(p[key]) || p[key] < min || p[key] > max)
      throw new Error(`Invalid ${key}`);
  }
  return {
    preset: p.preset,
    theme: p.theme,
    locale: p.locale,
    width: p.width,
    height: p.height,
    count: p.count,
    seed: p.seed,
  };
}
