import type { ScenarioDefinition, Preset } from "./protocol";
const rows = [
  ["workbench", "工作台", "工作台与分栏", "Workbench"],
  ["hosts", "主机与连接", "主机树与表格", "Host tree and table"],
  ["host-details", "主机与连接", "主机详情", "Host details"],
  ["host-transfer", "主机与连接", "主机导入导出", "Host import and export"],
  ["connect", "主机与连接", "连接与身份验证", "Connection and authentication"],
  ["connections", "主机与连接", "连接状态与质量", "Connections and quality"],
  ["known-hosts", "主机与连接", "已知主机", "Known hosts"],
  ["terminal", "终端与文件", "终端", "Terminal"],
  ["files", "终端与文件", "文件浏览", "File browser"],
  ["editor", "终端与文件", "文件编辑器", "Editor"],
  ["editor-conflict", "终端与文件", "编辑冲突", "Editor conflict"],
  ["preview", "终端与文件", "文件预览", "File preview"],
  ["forwarding", "网络与监控", "端口转发", "Port forwarding"],
  ["socks", "网络与监控", "SOCKS5", "SOCKS5"],
  ["monitor", "网络与监控", "监控", "Monitoring"],
  ["processes", "网络与监控", "进程列表", "Processes"],
  ["tasks", "任务与诊断", "后台任务与传输", "Background tasks and transfers"],
  ["output", "任务与诊断", "输出与诊断", "Output and diagnostics"],
  ["history", "任务与诊断", "命令历史", "Command history"],
  ["plugins", "插件", "插件列表与权限", "Plugins and permissions"],
  ["plugin-details", "插件", "插件详情", "Plugin details"],
  ["plugin-view", "插件", "插件提供者与恢复", "Plugin providers and recovery"],
  ["welcome", "其他", "欢迎", "Welcome"],
  ["about", "其他", "关于", "About"],
  ["dialogs", "公共控件", "确认与授权对话框", "Confirmations and consent"],
  ["menus", "公共控件", "菜单与命令面板", "Menus and command palette"],
  ["notifications", "公共控件", "通知与错误详情", "Notifications and errors"],
  ["forms", "公共控件", "表单、禁用与验证", "Forms and validation"],
  [
    "floating",
    "工作台",
    "浮动面板与状态保持",
    "Floating panels and retained state",
  ],
] as const;
const settings = [
  "general",
  "network",
  "appearance",
  "workspace",
  "terminal",
  "shortcuts",
  "files",
  "editor",
  "monitor",
  "updates",
  "plugins",
  "advanced",
  "about",
  "habits",
] as const;
const settingsLabels = [
  "常规",
  "网络",
  "外观",
  "工作区",
  "终端",
  "快捷键",
  "文件",
  "编辑器",
  "监控",
  "更新",
  "插件",
  "高级与存储",
  "关于",
  "使用习惯",
];
const presets: Preset[] = [
  "normal",
  "empty",
  "loading",
  "error",
  "boundary",
  "disabled",
];
const asynchronous = new Set([
  "files",
  "editor",
  "editor-conflict",
  "preview",
  "forwarding",
  "socks",
  "monitor",
  "processes",
  "output",
  "history",
  "known-hosts",
]);
const empty = new Set([
  "hosts",
  "connections",
  "known-hosts",
  "terminal",
  "files",
  "forwarding",
  "socks",
  "processes",
  "tasks",
  "output",
  "history",
  "plugins",
  "welcome",
  "forms",
]);
function support(id: string) {
  const supported = presets.filter(
    (preset) =>
      ["normal", "boundary"].includes(preset) ||
      (preset === "empty" && empty.has(id)) ||
      (["loading", "error"].includes(preset) && asynchronous.has(id)) ||
      (["disabled", "error"].includes(preset) && id === "forms"),
  );
  return {
    presets: supported,
    unsupportedPresets: Object.fromEntries(
      presets
        .filter((preset) => !supported.includes(preset))
        .map((preset) => [
          preset,
          `${preset}: 此界面没有独立的该状态适配；通过实际交互检查。 / No independent state adapter; inspect through normal interactions.`,
        ]),
    ),
  };
}
const checklist = [
  "主要信息与操作清晰可见",
  "窄空间没有遮挡或非预期溢出",
  "滚动、键盘焦点与 Escape 顺序正确",
  "状态与错误说明一致，草稿和选择得以保留",
];
const real = new Set([
  "workbench",
  "hosts",
  "host-details",
  "terminal",
  "files",
  "editor",
  "floating",
  ...settings.map((s) => `settings-${s}`),
]);
export const scenarios: ScenarioDefinition[] = [
  ...rows.map(([id, category, title, titleEn]) => ({
    id,
    surface: id,
    category,
    title,
    titleEn,
  })),
  ...settings.map((section, index) => ({
    id: `settings-${section}`,
    surface: `settings-${section}`,
    category: "设置",
    title: `设置 · ${settingsLabels[index]}`,
    titleEn: `Settings · ${section}`,
  })),
].map((row) => ({
  ...row,
  targets: real.has(row.id)
    ? ["browser", "native-mock", "native-service"]
    : ["browser", "native-mock"],
  ...support(row.id),
  checklist: [...checklist],
  prepareSteps: [
    "创建独立渲染上下文 / Create an isolated rendering context",
    "通过受控生产接口准备确定性数据 / Prepare deterministic state through controlled production boundaries",
    "等待目标组件就绪 / Wait for the target component to mount",
  ],
  interactionTests: ["e2e/scenarios.spec.ts"],
  ...(real.has(row.id)
    ? {}
    : {
        limitation:
          "真实服务模式尚无该场景的自动准备步骤；可使用浏览器或原生界面模拟。",
      }),
}));
export function scenarioById(id: string): ScenarioDefinition {
  const value = scenarios.find((s) => s.id === id);
  if (!value) throw new Error(`Unknown scenario: ${id}`);
  return value;
}

/** Explicit code registration; extension data never executes JS received over IPC. */
export function registerScenarioExtension(
  namespace: string,
  definitions: ScenarioDefinition[],
) {
  if (!/^[a-z][a-z0-9-]*$/.test(namespace))
    throw new Error("Invalid extension namespace");
  const existing = new Set(scenarios.map((scene) => scene.id));
  const surfaces = new Set(scenarios.map((scene) => scene.surface));
  for (const scene of definitions) {
    if (
      !scene.id.startsWith(namespace + ".") ||
      existing.has(scene.id) ||
      !surfaces.has(scene.surface) ||
      scene.targets.some((target) => target !== "browser")
    )
      throw new Error("Invalid or unreviewed extension registration");
    existing.add(scene.id);
  }
  scenarios.push(...structuredClone(definitions));
}
