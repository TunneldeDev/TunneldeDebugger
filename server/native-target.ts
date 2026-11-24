import type {
  DebugTarget,
  ScenarioDefinition,
  ScenarioParameters,
  TargetKind,
} from "../shared/protocol";
import { NativeManager } from "./native";
/** Common development contract backed by the managed native lifecycle. */
export class NativeDebugTarget implements DebugTarget {
  private pending?: {
    scenario: ScenarioDefinition;
    parameters: ScenarioParameters;
  };
  private active = false;
  constructor(
    private manager: NativeManager,
    private mode: Exclude<TargetKind, "browser">,
  ) {}
  async describe() {
    return this.manager.describe();
  }
  async prepare(scenario: ScenarioDefinition, parameters: ScenarioParameters) {
    if (!scenario.targets.includes(this.mode))
      throw new Error("Unsupported scenario target");
    this.pending = { scenario, parameters };
  }
  async apply(generation: number) {
    if (
      !this.pending ||
      generation !== (this.active ? this.manager.state.generation + 1 : 1)
    )
      throw new Error("Stale or unprepared target generation");
    const { scenario, parameters } = this.pending;
    this.pending = undefined;
    if (!this.active) {
      await this.manager.start(this.mode, scenario, parameters);
      await this.manager.waitReady();
      this.active = true;
    } else {
      if (this.mode === "native-service")
        throw new Error("Real-service reset requires a fresh profile");
      await this.manager.apply(scenario, parameters);
    }
  }
  async snapshot() {
    return this.manager.call("debug.snapshot");
  }
  async reset() {
    await this.manager.stop();
    this.active = false;
    this.pending = undefined;
  }
  async dispose() {
    await this.reset();
  }
}
