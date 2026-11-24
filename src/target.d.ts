declare module "@tunnelde-target" {
  import type { ComponentType } from "react";
  import type {
    ScenarioDefinition,
    ScenarioParameters,
  } from "../shared/protocol";
  export function prepareScene(
    scene: ScenarioDefinition,
    parameters: ScenarioParameters,
  ): Promise<void>;
  export function snapshot(): unknown;
  export const SceneView: ComponentType<{
    scene: ScenarioDefinition;
    parameters: ScenarioParameters;
    onReady?: () => void;
  }>;
}
