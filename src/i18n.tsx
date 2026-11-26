import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { scenarios } from "../shared/scenarios";
export const english: Record<string, string> = {
  项目配置: "Project settings",
  关闭项目配置: "Close project settings",
  "本地 Tunnelde 项目路径": "Local Tunnelde project path",
  "使用含开发场景适配器的本地项目。切换项目前请停止实例和测试。":
    "Use a local project with the scene adapter. Stop instances and tests before switching projects.",
  服务端口: "Service port",
  "仅监听 127.0.0.1。渲染、原生前端与 HMR 分别使用端口 +1、+2、+3；修改端口后需重启。":
    "Listens on 127.0.0.1. Renderer, native frontend and HMR use ports +1, +2 and +3. Restart after changing the port.",
  "Cargo 启动参数（JSON 数组）": "Cargo arguments (JSON array)",
  "Cargo 启动参数": "Cargo arguments",
  "应用启动参数（JSON 数组）": "Application arguments (JSON array)",
  应用启动参数: "Application arguments",
  "环境变量（JSON 对象）": "Environment variables (JSON object)",
  启动环境变量: "Launch environment",
  "调试 feature、数据目录、凭据和插件隔离由 Debugger 管理。":
    "Debugger manages the debug feature and data, credentials and plugin isolation.",
  当前接口与存储位置: "Current endpoints and storage",
  场景渲染器: "Scene renderer",
  原生前端: "Native frontend",
  记录目录: "Records directory",
  配置文件: "Settings file",
  检查项目: "Check project",
  保存并应用: "Save and apply",
  配置已保存并应用: "Settings saved and applied",
  "配置已保存，服务端口将在重启 Debugger 后生效":
    "Settings saved. Restart Debugger to use the new port.",
  项目与场景适配器可用: "Project and scene adapter are available",
  "项目有效，但缺少场景适配器":
    "Project is valid but the scene adapter is missing",
  优先级: "Priority",
  问题优先级: "Issue priority",
  "P0 · 阻断": "P0 \u00b7 Critical",
  "P1 · 高": "P1 \u00b7 High",
  "P2 · 中": "P2 \u00b7 Medium",
  "P3 · 低": "P3 \u00b7 Low",
  "P4 · 建议": "P4 \u00b7 Suggestion",
  检查中: "In review",
  待复测: "Needs retest",
  已修复: "Fixed",
  不适用: "Not applicable",
  重复问题: "Duplicate",
  暂不处理: "Deferred",
  回收站: "Trash",
  返回记录: "Back to records",
  恢复记录: "Restore record",
  记录已移入回收站: "Record moved to trash",
  图片预览: "Image preview",
  关闭预览: "Close preview",
  上一张: "Previous image",
  下一张: "Next image",
  原始尺寸: "Actual size",
  放大图片: "Zoom image in",
  缩小图片: "Zoom image out",
  拖动画布: "Pan canvas",
  拖动画布区域: "Canvas drag area",
  居中画布: "Center canvas",
  关闭检查器: "Close inspector",

  记录问题: "Report an issue",
  编辑记录: "Edit record",
  返回新记录: "Back to new record",
  "草稿自动保留，切换场景后可继续填写":
    "Drafts stay available when switching scenes",
  问题标题: "Issue title",
  问题描述: "Description",
  "例如：窄窗口下保存按钮被遮挡":
    "For example: Save is hidden in a narrow window",
  "记录具体问题，也可以直接粘贴截图":
    "Describe the issue or paste a screenshot",
  复现步骤与预期结果: "Steps and expected result",
  复现步骤: "Steps to reproduce",
  预期结果: "Expected result",
  截取当前界面: "Capture current UI",
  上传图片: "Attach images",
  上传验收图片: "Upload acceptance images",
  无法截图时可上传或粘贴图片:
    "Attach or paste an image if capture is unavailable",
  截取当前操作状态: "Capture the current interaction state",
  "可上传、粘贴或拖入图片": "Upload, paste or drop images here",
  下载: "Download",
  标注: "Annotate",
  移除: "Remove",
  检查清单: "Checklist",
  结论: "Result",
  验收结论: "Acceptance result",
  有问题: "Issue found",
  "处理中…": "Working…",
  保存记录: "Save record",
  保存修改: "Save changes",
  修改已保存: "Changes saved",
  记录已保存: "Record saved",
  验收记录: "Acceptance records",
  全部场景: "All scenes",
  搜索验收记录: "Search acceptance records",
  搜索标题或问题描述: "Search titles or descriptions",
  记录已删除: "Record deleted",
  撤销删除: "Undo delete",
  记录已恢复: "Record restored",
  暂无验收记录: "No acceptance records",
  无文字说明: "No description",
  编辑: "Edit",
  删除: "Delete",
  "删除这条记录？可撤销。": "Delete this record? You can undo this.",
  确认删除: "Delete record",
  "截图已加入草稿，请保存记录":
    "Screenshot attached to draft. Save the record to finish.",
  "图片已加入草稿，请保存记录":
    "Images attached to draft. Save the record to finish.",
  标注截图: "Annotate screenshot",
  拖动框出问题位置: "Drag to mark the problem area",
  关闭标注: "Close annotation",
  截图标注画布: "Screenshot annotation canvas",
  撤销标记: "Undo mark",
  保存标注: "Save annotation",
  "保存中…": "Saving…",
  收起侧栏: "Close sidebars",
  切换资源管理器: "Toggle explorer",
  切换检查器: "Toggle inspector",
  预览缩放: "Preview zoom",
  预览比例: "Preview scale",
  缩小预览: "Zoom out",
  放大预览: "Zoom in",
  适应窗口: "Fit to window",
  "适应窗口 · ": "Fit · ",
  渲染视口尺寸: "Renderer viewport size",
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
  "正在导出…": "Exporting…",
  报告导出结果: "Report export result",
  报告已保存到本地: "Report saved locally",
  导出报告路径: "Exported report path",
  打开导出目录: "Open export folder",
  下载报告: "Download report",
  关闭导出提示: "Dismiss export notice",
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
  "截取可见画面；浏览器中请选择此标签页": "Capture the visible view; select this tab in the browser picker",
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
  失败状态: "Error state",
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
    .replace("预览历史截图 ", "Preview saved screenshot ")
    .replace("预览截图 ", "Preview screenshot ")
    .replace("历史截图 ", "Saved screenshot ")
    .replace("验收截图 ", "Screenshot ")
    .replace("移除截图 ", "Remove screenshot ")
    .replace("截图 ", "Screenshot ")
    .replace("复现步骤：", "Steps: ")
    .replace("预期结果：", "Expected: ")
    .replace("适应窗口 · ", "Fit · ")
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
  // Keep the same React child/key structure in both locales, including iframe hosts.
  if (typeof node === "string")
    return locale === "en-US" ? translate(node) : node;
  if (Array.isArray(node))
    return Children.map(node, (child) => localize(child, locale));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props: Record<string, unknown> = {};
  for (const key of ["title", "body", "placeholder", "aria-label", "alt"])
    if (locale === "en-US" && typeof element.props[key] === "string")
      props[key] = translate(element.props[key] as string);
  if (element.props.children !== undefined)
    props.children = Children.map(
      element.props.children as ReactNode,
      (child) => localize(child, locale),
    );
  return cloneElement(element, props);
}
