# Contributing / 参与贡献

[中文](#中文) · [English](#english)

## 中文

感谢你帮助改进 TunneldeDebugger。这个项目同时包含浏览器工作台、Tauri 桌面宿主、Node 服务和原生实例适配，提交问题时请尽量说明受影响的运行模式与平台。

### 开始之前

- 使用 Node.js 24+、pnpm 10+ 和 Git。
- 原生开发需要 Rust 与当前平台的 Tauri 依赖；macOS 还需要 Xcode Command Line Tools。
- 调试器需要一个相邻的 Tunnelde 检出。首次开发可执行 `pnpm setup:target ../Tunnelde ../Tunnelde-debugger-target` 创建隔离目标。
- 不要提交 `.tunnelde-debugger/`、`dist/`、`test-results/`、`playwright-report/` 或 `src-tauri/target/` 中的本地产物。
- 安全问题不要公开提交 Issue，请按 [安全策略](SECURITY.md) 私密报告。

### 开发流程

1. 从最新的 `main` 创建聚焦的分支，例如 `feat/acceptance-filter` 或 `fix/native-window-focus`。
2. 安装依赖并准备目标：

   ```sh
   pnpm install --frozen-lockfile
   pnpm setup:target ../Tunnelde ../Tunnelde-debugger-target
   pnpm exec playwright install chromium
   ```

3. 完成改动，并同步更新中英文文档或界面文案。
4. 提交 PR 前运行与改动范围匹配的检查：

   ```sh
   pnpm check
   pnpm test:browser
   ```

   涉及真实运行器时运行 `pnpm acceptance:runners`；涉及原生窗口时运行 `pnpm acceptance:native`。后两者需要本地服务或 macOS 桌面会话。

### 提交信息

提交信息采用 Conventional Commits，例如：

```text
feat(acceptance): add severity filter
fix(native): release instance ownership after timeout
docs: clarify target setup
```

请把无关重构、格式化与功能修改拆成独立提交或 PR，方便审阅和回滚。

### Pull Request

- 描述问题、解决方式和用户可见影响。
- 列出实际执行的检查与平台；未执行的检查请明确标注。
- UI 改动请附截图或录屏，并说明浅色/深色、窄窗口和键盘操作是否覆盖。
- 原生改动请注明 macOS、Windows、Linux 中哪些平台完成了源码检查，哪些平台完成了实际交互验收。
- 不要附带本地数据、凭据、真实主机信息或未经审查的日志。

### 发布流程（维护者）

1. 更新 `package.json`、`src-tauri/tauri.conf.json` 与 `CHANGELOG.md` 中的版本。
2. 确认 `main` 上的 macOS、Windows、Linux 检查全部通过。
3. 创建 `vX.Y.Z` 标签和 GitHub Release。
4. 当前阶段只发布源码；除非安装包与各平台验收记录齐全，否则不要附加未经证实的构建产物。

## English

Thank you for improving TunneldeDebugger. The project combines a browser workbench, a Tauri desktop host, a Node service and native-instance adapters. Please identify the affected run mode and platform when reporting or fixing an issue.

### Before you start

- Use Node.js 24+, pnpm 10+ and Git.
- Native development requires Rust and the platform's Tauri dependencies. macOS also requires Xcode Command Line Tools.
- The debugger needs a neighboring Tunnelde checkout. For a first setup, run `pnpm setup:target ../Tunnelde ../Tunnelde-debugger-target` to create an isolated target.
- Do not commit local artifacts under `.tunnelde-debugger/`, `dist/`, `test-results/`, `playwright-report/` or `src-tauri/target/`.
- Report security issues privately according to the [security policy](SECURITY.md), not in a public issue.

### Development workflow

1. Branch from the latest `main` with a focused name such as `feat/acceptance-filter` or `fix/native-window-focus`.
2. Install dependencies and prepare the target:

   ```sh
   pnpm install --frozen-lockfile
   pnpm setup:target ../Tunnelde ../Tunnelde-debugger-target
   pnpm exec playwright install chromium
   ```

3. Make the change and update both Chinese and English documentation or UI copy when applicable.
4. Run the checks that match the change before opening a pull request:

   ```sh
   pnpm check
   pnpm test:browser
   ```

   Run `pnpm acceptance:runners` for real test-runner integration and `pnpm acceptance:native` for native-window work. These require a running local service or an interactive macOS desktop session.

### Commit messages

Use Conventional Commits, for example:

```text
feat(acceptance): add severity filter
fix(native): release instance ownership after timeout
docs: clarify target setup
```

Keep unrelated refactors, formatting and behavior changes in separate commits or pull requests.

### Pull requests

- Explain the problem, the solution and the user-visible impact.
- List the checks and platforms you actually exercised; call out anything you did not run.
- Include screenshots or recordings for UI changes and note light/dark mode, narrow-window and keyboard coverage.
- For native changes, distinguish source checks from actual interactive acceptance on macOS, Windows and Linux.
- Do not include local data, credentials, real host information or unreviewed logs.

### Release process (maintainers)

1. Update the version in `package.json`, `src-tauri/tauri.conf.json` and `CHANGELOG.md`.
2. Confirm the macOS, Windows and Linux checks pass on `main`.
3. Create a `vX.Y.Z` tag and GitHub Release.
4. Releases are source-only for now. Do not attach an installer unless its platform builds and acceptance evidence are complete.
