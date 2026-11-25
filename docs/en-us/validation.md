# Coverage and validation

Executed on 2026-11-25 using macOS / Apple Silicon, Node 26 and pnpm 12. Target baseline: Tunnelde `df711371861870fce9393d154f27549730b6d891`. See the [coverage registry](coverage.md).

| Check                                                                                                 | Result                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workbench types, protocol, cancellation, partial failure, dynamic cases, exact selection and recovery | 17 tests passed; workbench production build passed                                                                                                                                         |
| Browser production components and interactions                                                        | 66 passed: all 43 surfaces, preview zoom, issue/screenshot persistence, drafts, edits/deletion/trash restoration, paste/drop and failure retention; 11 acceptance/workspace and language-preservation workflows also passed WebKit |
| Consecutive native mock switching                                                                     | 43 passed in one instance with increasing generations; each generation rejects bad tokens, stale generations, unknown scenarios and arbitrary commands                                     |
| Native real services                                                                                  | 5 passed: hosts, terminal, files, editor and general settings; host CRUD, settings write/read/restore, editor save/backend read, SSH input and same-session SFTP CRUD                      |
| Native window round trips                                                                             | Terminal, SFTP and editor passed, comparing session, file roots, draft fingerprint and selection; satellite and main screenshots captured separately                                       |
| Subsequent native verification                                                                        | Actual workbench split and remote SFTP satellite passed again; initial local file root is isolated                                                                                         |
| Unified runners                                                                                       | Vitest, Node, Playwright and Rust passed through the same discovery/scheduling APIs; additional exact Rust library/integration cases and duplicate nested Node names verified              |
| Existing target Vitest suite                                                                          | 389 files / 3,158 tests passed; this does not claim the entire Rust/Node suites ran                                                                                                        |
| Rust development endpoint                                                                             | 3 feature-enabled tests passed; feature-disabled cargo check passed                                                                                                                        |
| Production injection exclusion                                                                        | Production build passed even with the frontend flag set; JS assets exclude developer entry/fixture markers; Rust commands require both feature and debug_assertions                        |
| Code and documentation                                                                                | Target types, changed TS ESLint, bilingual path check and 2,758 translation-key consistency passed                                                                                         |
| Patch reproduction                                                                                    | git apply --check passed in a clean worktree at the pinned baseline                                                                                                                        |

This revision also captured an actual macOS target window and saved the issue with its image after stopping the instance and changing generation. This automated check does not imply human visual approval.

Local run IDs: native batch `9d523279-36cb-4660-8786-6a9416f856b9` (48 tasks), follow-up `8ef47ef0-1a3a-4620-b189-111422014b32` (2 tasks), runners `4fef685d-2165-40ab-a5ae-a5e9321ed18b`. Earlier failed runs remain preserved. Historical results apply only to their recorded source fingerprint.

## Manual checks and scope

- Human visual conclusions await individual reviewer submission. Automated native smoke does not imply visual approval of every control and parameter combination.
- Browser and native simulation reuse production components. The simulated terminal only echoes input. The controlled real SSH fixture also does not execute a system shell.
- Mock rename/copy, forwarding start/stop and some plugin management operations are not adapted and fail explicitly. Real-service scenarios without registered preparation carry a limitation. Empty/loading/error/disabled presets are exposed only for adapted surfaces; others show N/A.
- External plugins have a reviewed code-registration example only. No third-party plugin code or exhaustive external-plugin behavior was tested.
- Screenshots capture macOS target windows, without baseline approval. Other-platform capture is not implemented. Capture failures cannot create successful evidence.
- Source boundaries isolate everyday and debug data/plugin/credential namespaces; no reads/writes against the user's everyday application data were used for acceptance.
- macOS, Windows and Linux source checks and desktop host compilation passed the [platform CI matrix](https://github.com/TunneldeDev/TunneldeDebugger/actions/runs/45490467265). Windows/Linux actual window interaction and human visual acceptance remain unverified. No installers or Releases are included.

## Retention

The index retains the latest 200 runs; the UI loads the latest 100. All case results persist. The console shows up to 4,000 recent events, while complete JSONL event journals remain in `logs/` and can be downloaded from the console. Screenshots live in `artifacts/`; manual conclusions live in `acceptance.json`. Older runs without a full journal report it unavailable. JSON exports reference local artifacts; include the relevant files when sharing.

This revision also checks docked inspector close and narrow-window split, iframe movement, retained input and scale across language changes, toolbar layout from 460–1600px, in-app images, priority and trash restoration. Live project switching and switch-back, Cargo argument injection, custom-port macOS desktop startup and cargo check passed. Browser regressions use an isolated data directory. See desktop CI for actual Windows/Linux results; human platform acceptance remains separate.
