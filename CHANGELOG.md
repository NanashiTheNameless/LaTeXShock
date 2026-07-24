# Changelog

All notable changes to the LaTeXShock extension are documented here.

## 0.0.2

- Fixed: setting `latexShock.safety.hardMaxPower` to 0 now sends nothing at all.
  Previously a computed intensity of 0 was floored to 1 and still fired, so the
  ceiling didn't work as a kill switch.
- Fixed: `.log` auto-detection no longer picks up unrelated logs (e.g.
  `npm-debug.log`); only files that look like a real TeX log are parsed.
- Added: OpenShock requests now time out after 10s instead of hanging.
- Support for VS Code / VSCodium 1.105.0 and up.
- Now installable from Open VSX, with in-editor auto-updates.

## 0.0.1

- First version.
