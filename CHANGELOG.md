# Changelog

All notable changes to TunneldeDebugger are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Releases are currently source-only.

## [Unreleased]

## [0.1.0] - 2026-11-25

### Added

- Browser and Tauri workbench for 43 production-component scenarios, including 14 settings sections with presets, deterministic seeds, themes, languages and viewport sizes.
- Unified discovery and execution for Vitest, Rust, Node, Playwright and native tasks, with selection, cancellation, partial-failure reporting and dynamic Node cases.
- Isolated native mock and real-service instances for hosts, settings, file editing, controlled SSH/SFTP and satellite-window round trips.
- Traceable acceptance records with reproducible drafts, screenshots, annotations, search, editing, Trash recovery and JSON export.
- Project settings for target paths, ports, Cargo/application arguments, environment variables and local storage endpoints.
- Bilingual documentation, validation notes and a macOS/Windows/Linux source-check workflow.

### Changed

- Docked the acceptance inspector, added narrow-window split layouts and preserved preview scale and iframe state across language changes.
- Added fit-to-window, percentage and 100% preview zoom modes with panning and viewport controls.
- Rendered terminal output as safe ANSI text and improved dropdown keyboard and visual behavior.
- Added platform-aware desktop startup, custom ports and monitor-aware window sizing.

### Fixed

- Preserved horizontal and vertical scroll positions when capturing evidence.
- Pinned corrected target revisions and guarded preview/window alignment during resizing and navigation.
- Kept acceptance drafts and scene state through navigation, reload and responsive layout changes.

### Validation

- `pnpm check` passes type checking, 17 core tests and the production frontend build.
- 66 Chromium browser cases pass, with 11 WebKit acceptance/workspace cases also passing.
- 43 native mock generations and 5 real-service tasks pass on macOS.
- macOS, Windows and Linux source checks pass, including `cargo check --locked`.
- Windows and Linux native interactive acceptance remains unverified; no installers are attached.

[Unreleased]: https://github.com/TunneldeDev/TunneldeDebugger/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TunneldeDev/TunneldeDebugger/releases/tag/v0.1.0
