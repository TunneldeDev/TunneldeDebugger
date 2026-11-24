import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { scenarios } from "../shared/scenarios";
export const english: Record<string, string> = {
  下载完整事件日志: "Download full event journal",
  应用到当前模拟实例: "Apply to current mock instance",
  "连接中…": "Connecting…",
  "目标适配器不可用：": "Target adapter unavailable:",
  " macOS 首验": " macOS validation",
  "实例 ": "Instance ",
  "代次 ": "Generation ",
  "平台 ": "Platform ",
  本地工作区: "Local workspace",
  导出报告: "Export report",
  场景: "Scenes",
  测试: "Tests",
  原生: "Desktop",
  桌面实例: "Desktop instances",
  工作台导航: "Workbench navigation",
  场景资源管理器: "Scenario explorer",
  测试资源管理器: "Test explorer",
  搜索场景或测试: "Search scenarios or tests",
  "搜索界面、面板、场景…": "Search surfaces and scenarios…",
  "搜索测试…": "Search tests…",
  工作台: "Workbench",
  主机与连接: "Hosts and connections",
  终端与文件: "Terminal and files",
  网络与监控: "Network and monitoring",
  任务与诊断: "Tasks and diagnostics",
  插件: "Plugins",
  其他: "Other",
  公共控件: "Shared controls",
  设置: "Settings",
  "复用 Tunnelde 生产组件": "Tunnelde production components",
  按目标串行调度: "Serial scheduling per target",
  运行控制台: "Run console",
  测试运行: "Test runs",
  运行已发现全部: "Run all discovered",
  场景就绪: "Scene ready",
  加载场景: "Loading scene",
  截图: "Capture",
  关闭: "Close",
  运行记录: "Run history",
  测试输出: "Test output",
  取消: "Cancel",
  重跑失败: "Rerun failures",
  发现测试: "Discover tests",
  从一次测试开始: "Start with a test",
  "在左侧发现测试，选择文件或用例后运行。":
    "Discover tests, then select files or cases to run.",
  常规数据: "Normal",
  空数据: "Empty",
  加载中: "Loading",
  异常与失败: "Error",
  边界数据: "Boundary",
  禁用状态: "Disabled",
  排队中: "Queued",
  运行中: "Running",
  通过: "Passed",
  失败: "Failed",
  已取消: "Cancelled",
  已中断: "Interrupted",
  已跳过: "Skipped",
  待检查: "Pending",
  阻塞: "Blocked",
  未启动: "Stopped",
  构建与启动中: "Building and starting",
  已就绪: "Ready",
  应用场景中: "Applying scene",
  在真实桌面中验收: "Inspect the native desktop",
  "把当前场景发送到隔离的 Tunnelde 实例。":
    "Send the current scenario to an isolated Tunnelde instance.",
  "窗口、服务状态与验收记录保持关联。":
    "Link windows and service state to acceptance records.",
  界面模拟: "UI simulation",
  "可控数据 · 状态与边界": "Controlled data · states and boundaries",
  真实服务: "Real services",
  "隔离数据 · 实际读写": "Isolated data · real reads and writes",
  启动并注入场景: "Start and apply scenario",
  重启并注入场景: "Restart and apply scenario",
  停止: "Stop",
  移动到原生小窗: "Move to native window",
  返回主窗口: "Return to main window",
  检查真实读写: "Check service consistency",
  实例: "Instance",
  代次: "Generation",
  平台: "Platform",
  构建与实例日志: "Build and instance logs",
  重新加载场景: "Reload scenario",
  切换明暗主题: "Toggle theme",
  场景语言: "Scenario language",
  "正在挂载生产界面…": "Mounting production UI…",
  上一个: "Previous",
  下一个场景: "Next scenario",
  参数: "Parameters",
  诊断: "Diagnostics",
  验收: "Acceptance",
  场景配置: "Scenario configuration",
  "同一界面，多种状态。每次切换创建独立的渲染上下文。":
    "Inspect several states of each surface in independent rendering contexts.",
  数据预设: "Data preset",
  数据条目: "Data count",
  宽度: "Width",
  高度: "Height",
  视口宽度: "Viewport width",
  视口高度: "Viewport height",
  窄面板: "Narrow",
  桌面: "Desktop",
  宽屏: "Wide",
  固定随机种子: "Fixed random seed",
  随机种子: "Random seed",
  运行目标: "Targets",
  浏览器: "Browser",
  原生模拟: "Native UI simulation",
  "场景复用生产组件。模拟操作与真实服务的验收结果分别记录。":
    "Scenarios reuse production components. Simulation and real-service results are recorded separately.",
  重置配置: "Reset configuration",
  渲染诊断: "Rendering diagnostics",
  读取场景状态: "Read scenario state",
  人工验收: "Manual acceptance",
  验收备注: "Acceptance notes",
  "记录发现的问题、操作步骤与预期…":
    "Record issues, steps and expected behavior…",
  最近验收: "Recent acceptance",
  无备注: "No notes",
  验收截图: "Acceptance screenshot",
  本地服务已连接: "Local service connected",
  源码模式: "Source mode",
  场景已就绪: "Scene is ready",
  主要信息与操作清晰可见: "Main information and actions are visible",
  窄空间没有遮挡或非预期溢出:
    "No occlusion or unexpected overflow in narrow space",
  "滚动、键盘焦点与 Escape 顺序正确":
    "Scrolling, keyboard focus and Escape order work",
  "状态与错误说明一致，草稿和选择得以保留":
    "State and errors are consistent; drafts and selections persist",
};
for (const scene of scenarios) english[scene.title] = scene.titleEn;
function translate(value: string): string {
  if (english[value]) return english[value]!;
  const trimmed = value.trim();
  if (english[trimmed]) return value.replace(trimmed, english[trimmed]!);
  return value
    .replace("运行选中 (", "Run selected (")
    .replace(" 个内置场景", " built-in scenarios")
    .replace(" 个场景", " scenarios")
    .replace(" 项测试", " test selections")
    .replace(" 运行中", " running")
    .replace("协议 v1", "Protocol v1")
    .replace("平台", "Platform")
    .replace("源码 ", "Source ")
    .replace("工作区 ", "Workspace ");
}
/** Translate declared React copy only; never mutate iframe content or test names. */
export function localize(
  node: ReactNode,
  locale: "zh-CN" | "en-US",
): ReactNode {
  if (locale === "zh-CN") return node;
  if (typeof node === "string") return translate(node);
  if (Array.isArray(node))
    return Children.map(node, (child) => localize(child, locale));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props: Record<string, unknown> = {};
  for (const key of ["title", "body", "placeholder", "aria-label", "alt"])
    if (typeof element.props[key] === "string")
      props[key] = translate(element.props[key] as string);
  if (element.props.children !== undefined)
    props.children = Children.map(
      element.props.children as ReactNode,
      (child) => localize(child, locale),
    );
  return cloneElement(element, props);
}
