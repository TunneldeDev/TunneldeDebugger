# Security Policy

## Supported versions

TunneldeDebugger is pre-1.0. Security fixes are applied to the latest `0.1.x` source line and `main`.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| < 0.1 | No |

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:

<https://github.com/TunneldeDev/TunneldeDebugger/security/advisories/new>

Please do not open a public issue for a suspected vulnerability. Include the affected revision, platform, run mode (browser, desktop or native), reproduction steps, impact and any proposed mitigation. Remove credentials, private host names, tokens and personal paths from logs and screenshots.

The maintainers will validate the report and coordinate disclosure through the private advisory. No response-time guarantee is currently offered.

## Security model and boundaries

- The Node service and native endpoints are intended for loopback use. Do not bind them to a public interface or place them behind an unauthenticated reverse proxy.
- Test runners execute code from the selected target checkout. Only open repositories and test suites that you trust.
- The controlled SSH/SFTP fixture uses synthetic credentials and a confined temporary root. It is not a general-purpose SSH server.
- Native screenshots, acceptance records and project settings are local data. Review reports before sharing them.
- The project does not currently provide signed installers. Source-only releases avoid implying that an unverified binary is an official build.

## Dependency and CI policy

- Dependabot proposes updates for pnpm, Cargo and GitHub Actions.
- Pull requests run source checks on macOS, Windows and Linux.
- A dependency update still requires review of release notes and CI results; automated updates are not automatically trusted.
