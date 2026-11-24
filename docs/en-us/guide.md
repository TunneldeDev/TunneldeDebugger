# Guide and architecture

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
