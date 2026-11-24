import { isAbsolute, join, resolve } from "node:path";
import { stat, readFile } from "node:fs/promises";
import { JsonStore } from "./storage";
import { DEFAULT_LAUNCH, type ProjectSettings } from "../shared/project";
export function settingsStore(data: string, fallbackTarget: string) {
  return new JsonStore<ProjectSettings>(join(data, "project.json"), {
    targetPath: fallbackTarget,
    servicePort: 4760,
    launch: structuredClone(DEFAULT_LAUNCH),
  });
}
export function validateSettings(value: unknown): ProjectSettings {
  if (!value || typeof value !== "object")
    throw new Error("配置无效 / Invalid settings");
  const input = value as ProjectSettings;
  if (
    typeof input.targetPath !== "string" ||
    !isAbsolute(input.targetPath) ||
    input.targetPath.includes("\0")
  )
    throw new Error("请输入项目绝对路径 / Absolute project path required");
  if (
    !Number.isInteger(input.servicePort) ||
    input.servicePort < 1024 ||
    input.servicePort > 65532
  )
    throw new Error("服务端口必须在 1024–65532 之间 / Invalid service port");
  const list = (value: unknown) => {
    if (
      !Array.isArray(value) ||
      value.length > 64 ||
      value.some(
        (x) => typeof x !== "string" || x.length > 4096 || x.includes("\0"),
      )
    )
      throw new Error(
        "启动参数必须是字符串数组 / Launch arguments must be a string array",
      );
    return value as string[];
  };
  const launch = input.launch;
  if (
    !launch ||
    typeof launch.env !== "object" ||
    !launch.env ||
    Array.isArray(launch.env)
  )
    throw new Error("环境变量必须是对象 / Environment must be an object");
  const cargoArgs = list(launch.cargoArgs),
    appArgs = list(launch.appArgs);
  if (
    cargoArgs.some(
      (arg) =>
        /^--(?:release|profile|features|no-default-features|all-features|manifest-path)(?:=|$)/.test(
          arg,
        ) ||
        arg === "-F" ||
        arg.startsWith("-F"),
    )
  )
    throw new Error(
      "不能通过参数覆盖调试构建与 feature / Debug build and feature are managed by Debugger",
    );
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(launch.env)) {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
      typeof value !== "string" ||
      value.includes("\0") ||
      value.length > 8192
    )
      throw new Error("环境变量无效 / Invalid environment variable");
    if (/^(?:TUNNELDE_|VITE_|TAURI_)/.test(key))
      throw new Error(
        "隔离环境变量由 Debugger 管理 / Isolation variables are managed by Debugger",
      );
    env[key] = value;
  }
  return {
    targetPath: resolve(input.targetPath),
    servicePort: input.servicePort,
    launch: { cargoArgs, appArgs, env },
  };
}
export async function inspectProject(target: string) {
  const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
  await stat(join(target, "src-tauri/Cargo.toml"));
  let adapter = false;
  try {
    await stat(join(target, "src/debugger/index.tsx"));
    adapter = true;
  } catch {}
  return { name: String(pkg.name ?? "Tunnelde"), adapter };
}
