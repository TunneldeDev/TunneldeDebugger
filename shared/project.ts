export interface LaunchSettings {
  cargoArgs: string[];
  appArgs: string[];
  env: Record<string, string>;
}
export interface ProjectSettings {
  targetPath: string;
  servicePort: number;
  launch: LaunchSettings;
}
export const DEFAULT_LAUNCH: LaunchSettings = {
  cargoArgs: [],
  appArgs: [],
  env: { RUST_BACKTRACE: "1" },
};
