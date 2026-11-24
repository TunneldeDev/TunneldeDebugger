# TunneldeDebugger

[English](README.en-us.md)

Tunnelde 的本地开发与验收工作台。React 工作台可在浏览器或 Tauri 桌面运行，共用 Node 服务，支持生产组件场景、统一测试侧栏、隔离原生实例及可追溯的验收记录。

## 从源码启动

先将 Tunnelde 克隆到相邻的 `../Tunnelde` 目录（已有仓库可直接使用）。

要求 Node.js 24+、pnpm 10+、Git；原生模式还需 Rust 和 Tauri 对应平台的开发依赖。macOS 需 Xcode Command Line Tools。首次浏览器测试需安装 Chromium。

```sh
pnpm install --frozen-lockfile
pnpm setup:target ../Tunnelde ../Tunnelde-debugger-target
pnpm exec playwright install chromium
pnpm dev
# 另一个终端；复用同一个服务
pnpm desktop
```

浏览器打开 <http://127.0.0.1:4760>。`setup:target` 在主仓库旁创建独立 worktree，应用随附适配补丁，不修改原工作区的文件。补丁固定到 `integration/base.json` 中的远端 dev 版本；升级基线应重新移植并验证补丁。

可用 `pnpm dev --target /absolute/checkout --data /absolute/local-data --port 4760` 指定路径。环境变量为 `TUNNELDE_TARGET`、`TUNNELDE_DEBUGGER_DATA`。连续四个端口分别用于工作台、iframe、原生前端和 HMR。桌面包装目前使用默认端口。

## 使用

- **场景**：43 个内置界面条目，包括 14 类设置；支持适用的数据预设、固定种子、主题、语言和尺寸。iframe 加载 Tunnelde 的生产组件，样式、焦点和内存存储独立。
- **测试**：分别发现 Vitest、Rust、Node、Playwright 和原生任务，展开文件或用例，运行选择项或已发现全部，查看输出、耗时、失败与取消结果。Node 动态子用例在运行后加入树中。首次 Rust 发现需要编译测试程序。
- **桌面实例**：选择“界面模拟”或“真实服务”，启动隔离 Tunnelde。真实服务可检查主机、设置、文件编辑以及受控 SSH/SFTP，并将生产面板移到原生小窗再返回。
- **验收**：逐项人工检查，记录待检查、通过、失败、阻塞、备注和截图，导出 JSON 报告。自动冒烟结果与人工结论分开保存。

原生模拟切换会重建文档，真实服务场景重启使用新配置目录。测试队列占用原生实例时，手工原生操作会收到明确的占用提示。

## 验证

```sh
pnpm check                 # 类型、协议/调度/进程测试、工作台构建
pnpm test:browser          # 生产界面及关键交互
pnpm acceptance:runners    # 四类运行器真实发现与精确选择，需要服务运行
pnpm acceptance:native     # 43 个原生模拟 + 5 个真实服务任务，需要 macOS
# 单独重跑
pnpm acceptance:native 'native:native-service#files'
```

参阅[操作与架构](docs/zh-cn/guide.md)、[覆盖与验收说明](docs/zh-cn/validation.md)及[主仓库适配补丁](integration/tunnelde.patch)。原生窗口检查需要可交互的桌面会话；截图失败会保留原因，不生成成功截图证据。

运行数据位于 `.tunnelde-debugger/`，包含运行记录、验收记录、实例配置、日志和产物；已加入 Git 忽略。关闭实例并备份所需报告后，可删除该目录。未完成任务在服务重启后标为“已中断”。

此版本从源码运行，未制作安装包、未发布远端仓库。Windows/Linux 原生功能保留源码适配，尚未实际验收。许可证 GPL-3.0-only。
