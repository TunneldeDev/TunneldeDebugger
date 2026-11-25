# Guide and architecture

## Preview zoom and layout

The preview defaults to **Fit to window** and resizes with the window and sidebars to show the full scene. Use minus, the percentage menu, or plus above the preview for manual zoom (10%–200%). Choose 100% for actual pixels, or click **Fit to window** to resume automatic scaling. Scroll horizontally and vertically when a manually enlarged preview exceeds the canvas.

Zoom changes presentation only, preserving the scene viewport, data, generation and screenshot resolution. Width and height in the inspector change the actual rendering viewport for responsive-layout checks. The buttons at either end of the scene heading toggle the explorer and inspector. The inspector starts closed and docks on the right when opened. Narrow windows use a vertical split without covering the preview. The explorer collapses when space is limited and can be opened as needed. The workbench uses Tunnelde's graphite palette, while each scene keeps independent theme and language settings.

## Report issues and manage acceptance

Click **Report an issue**, enter a title and description, choose a conclusion and P0–P4 priority, then **Save record**. The save controls stay near the top of the form. Success is shown only after the service writes the record to disk. Steps, expected results and the checklist are expandable. Failed or unavailable targets can still have issue and blocked records; a pass requires matching scene readiness and source identity.

**Capture** and **Capture current UI** preserve the current inputs, dialogs, selections and scroll state instead of launching the initial scene again. Browser images are generated from the current document; complex graphics and browser-specific effects can differ from native screenshots. Attach a system screenshot for exact pixel evidence. Native capture still uses the target window. Upload PNG/JPEG/WebP images, paste into the form, or drop images into the attachment area. **Annotate** adds numbered red rectangles. Images can be previewed, downloaded or removed.

Unsubmitted drafts, including attachment references, stay in the current browser by scene, parameters, target and source version. Navigate, switch tabs or reload to continue editing. Drafts are separate from submitted records and do not survive clearing browser storage or changing browsers. Images and submitted records are stored in the debugger's local data directory.

Search records, include all scenes, edit text/results/priority/attachments, or delete a mistaken record. Deletion moves it directly to **Trash**, where any deleted record can be searched and restored, including after reload. Image files are retained and deleted records are excluded from exports. Edits retain the original parameters and source identity. Stale edits from another window are rejected to prevent overwriting newer changes. Save errors retain the form and show the reason.

## Project settings and desktop controls

**Project settings** in the top bar exposes the absolute local Tunnelde path, service port, Cargo arguments, application arguments and environment. Expand Current endpoints and storage to see API, renderer, native frontend, data and settings locations. Arguments are JSON arrays and environment is a JSON object, passed directly to child processes. Configuration persists in local `project.json`. Stop all instances and tests before switching projects. Saving a new path rebuilds the scene service and clears discovered tests. A regular checkout without `src/debugger/index.tsx` needs `integration/tunnelde.patch` applied in an isolated checkout and dependencies installed; Debugger never modifies the chosen checkout automatically.

Port changes require restarting Debugger. Renderer, native frontend and HMR use +1, +2 and +3 on loopback only. `pnpm desktop --port 4880 --target /absolute/Tunnelde --data /absolute/debug-data` starts an independent desktop service with matching URL and CSP. CLI options override saved settings. Windows uses a platform-aware child launcher and cancellation terminates the process tree. GitHub Actions checks workbench and desktop sources on macOS, Windows and Linux. Native screenshot capture remains macOS-only; upload system screenshots elsewhere. Actual platform validation is reported separately.

The inspector starts closed and stays docked when opened, using a vertical split in narrow windows. The preview fits the remaining space while preserving its rendering viewport and interactive state. The inspector header always provides Close, and its content scrolls independently. Drag the iframe titlebar or enable Pan canvas and drag over the preview; exit Pan mode to interact with the application. Center canvas resets position and restores fit. Click images for an in-app preview with actual size, zoom and previous/next images; Escape closes it. Graphite dropdowns support keyboard navigation and Escape.

Priority and conclusion are independent: P0 critical, P1 high, P2 medium, P3 low, P4 suggestion. Conclusions include Pending, In review, Issue found, Blocked, Needs retest, Fixed, Passed, Not applicable, Duplicate and Deferred. Priority never grants a pass. ANSI standard, bright, 256-color and RGB logs render safely without exposing other terminal controls.

## Data flow

React workbench → loopback Node service → runner or controlled native protocol. A separate-origin iframe imports the target's `src/debugger/index.tsx`, reusing production AppShell, pages, controls, styles and Services. Switching recreates the iframe; localStorage/sessionStorage are replaced with document-local memory storage.

`shared/protocol.ts` defines `ScenarioDefinition` (presets, targets, preparation, checklist and test links), `DebugTarget` (discovery, prepare, apply, snapshot, disposal) and `TestRunnerAdapter` (discovery, execution, cancellation signal and events). `server/native-target.ts` implements the target contract for native instances.

## Scenarios and extensions

`shared/scenarios.ts` is the coverage registry. Theme, locale, viewport and seed are independent parameters. Inapplicable presets show N/A reasons. Boundary data contains at least 1,000 and at most 10,000 entries, with long multilingual names and nested groups. Fixed controls retain a small amount of content rather than duplicating controls to match the data count.

The mock adapter owns mutable hosts, settings, files, forwarding and plugin data. Unimplemented calls throw `Unsupported fixture operation`; they do not return fabricated success. The mock terminal only echoes input; real-service tasks connect to SSH. A registered synthetic plugin uses the production declarative plugin renderer.

`examples/plugin-scenarios.ts` demonstrates code registration: review it, then call `registerScenarioExtension` in the shared scenario module, loaded by both workbench and renderer. Extensions reference known surfaces and browser targets only. No scripts, component paths or arbitrary invokes are accepted through the protocol.

## Native isolation and lifecycle

The target requires the Cargo `debugger` feature, a debug build, frontend DEV flag, runtime flag, isolated application identifier and a profile marker matching runId. Normal builds do not register development commands. Credentials use the target's existing application-scoped namespace; the debug identifier is `dev.tunnelde.debugtarget`. Node creates fresh UUID data/plugin directories for real-service tasks.

The native endpoint listens on `127.0.0.1` only. Its descriptor contains an independent random token, version and runId. Requests enforce capacity, authentication, timeout and generation checks, accepting only registered scenarios, parameters and actions. The workbench service checks Host, Origin and JSON requests.

An accepted request is not ready until the frontend acknowledges component commit. Mock switching reloads the document to dispose subscriptions, caches and memory storage. Real-service resets restart with a fresh directory. Native windows retain production ownership/generation checks; the actual owning satellite performs the return operation.

The controlled SSH/SFTP fixture accepts synthetic credentials on loopback. SFTP is confined to a temporary root, rejecting traversal and symlinks. The terminal provides controlled echo without executing a system shell. Both initial local and remote file panes explicitly open fixture roots. Normal production file navigation remains available to the operator.

## Test management

Expand runner, directory, file and case nodes. Vitest uses existing configuration and a structured reporter. Rust compiles and lists actual binaries, executing individual cases with `--exact`. Node uses native test events and adds dynamic cases after execution. Playwright shares the scenario registry. Native tasks are separate from browser results.

“Run all discovered” executes only the registered, discovered set; undiscovered runners do not count as passed. Rust ignored tests are marked separately. Runtime skipped/todo cases do not count as passed cases. External requirements retain the suite's skip/ignored behavior; requirements that cannot be inferred statically appear in runtime errors/output. A single queue serializes work for the target while each runner retains internal concurrency.

Cancellation terminates the entire process group, then forces cleanup. On restart, unfinished tasks become interrupted and prior evidence remains. Node discovery scans files without executing dynamic cases early.

## Records and evidence

`.tunnelde-debugger/runs.json`, `acceptance.json` and `artifacts/` hold local records, written through temporary files and atomic rename. Source identity includes absolute path, Git revision, fingerprint of working diff/untracked contents and protocol version. A passed conclusion requires matching readiness and parameters; reload after source changes.

macOS screenshots use the target's NSWindow number after focusing that window. Native tasks capture the satellite and the returned main window separately. Failed captures retain an explicit reason. JSON reports reference local images; include the selected artifact files when sharing a report.

Manual conclusions belong to the reviewer. Persistence tests create sample records with the note `Playwright acceptance record`; these are not completed human approval.
