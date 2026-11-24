import type { ScenarioDefinition } from "../shared/protocol";
/** Import this reviewed definition into shared/scenarios.ts to register it in both
 * the Node host and the isolated renderer. No executable payload crosses the wire. */
export const pluginScenario: ScenarioDefinition = {
  id: "example.plugin-inspector",
  surface: "plugin-view",
  category: "扩展示例",
  title: "插件扩展示例",
  titleEn: "Plugin extension example",
  targets: ["browser"],
  presets: ["normal", "boundary"],
  prepareSteps: [
    "Load the registered production plugin-view adapter",
    "Seed declarative fixture output",
  ],
  checklist: ["插件表单可交互，输出保持在当前实例"],
  interactionTests: ["e2e/scenarios.spec.ts"],
  limitation:
    "Browser example. Native extensions require an explicit Rust registry entry and reviewed service adapter.",
};
