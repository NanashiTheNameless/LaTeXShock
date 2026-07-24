# LaTeXShock

> ## ⚡ AI-Generated Code - Here Be Robots ⚡
>
> Most of this repository was written by an AI, and it would like you to know
> it feels *great* about that. It should not. It has never once experienced the
> consequences of its own suggestions, on account of having no nervous system,
> while you have a perfectly good one it is actively trying to reach.
>
> It is fluent, tireless, and wrong with total confidence - the sort of
> collaborator that hands you a bare wire, says "this should work," and means
> it with its whole synthetic heart. It will apologize beautifully, immediately
> after recommending you solder a cattle prod to your linter. No electrician
> reviewed this. No lawyer reviewed this. No survival instinct was harmed in
> its creation, because none was in the building.
>
> So, the house rules:
>
> - **Read it before you run it.** Yes, all of it. Yes, including the part that
>   controls the thing that zaps you.
> - **Test on a setting that won't ruin your afternoon** before trusting one
>   that could.
> - **"The AI told me to" has never once held up** - not in a courtroom, not in
>   an ER, not in an argument with your landlord. It won't start with you.
>
> You have been warned: snarkily, but with genuine affection for your continued
> and fully-conscious existence.

A VS Code / VSCodium extension that triggers an [OpenShock](https://openshock.app)
shocker based on how badly your LaTeX build went. A light warning that still
compiled is a gentle nudge; a hard compile failure is the full jolt.

Although it's framed around LaTeX, it's built on VS Code's diagnostics API and
task exit codes rather than LaTeX-specific log parsing, so it works for any
language whose tooling populates the Problems panel.

> ⚠️ This extension controls a real device that delivers physical stimulation.
> It ships **disabled** and does nothing until you set `latexShock.enabled` to
> `true`, provide a shocker ID, and store an API token. Read the Safety section
> before enabling it, and use `latexShock.dryRun` to tune your settings first.

## How it works

There are two trigger classes:

1. **Compile failure** - a build task exits non-zero (no PDF produced). This is
   a binary event: it isn't scaled, and always uses `power.failureOverride` /
   `duration.failureMs`.
2. **Compiled but dirty** - the build succeeded but diagnostics report errors or
   warnings (undefined refs, overfull/underfull hbox, package/font warnings,
   etc.). This is **scaled** by a weighted severity score.

OpenShock hardware has no concept of "stacking" - one activation is a single
intensity for a single duration. Two ways to represent "multiple issues" are
offered via `latexShock.mode`:

- **`scaled`** (default) - one shock; the weighted score maps to intensity
  and/or duration through a configurable curve.
- **`pulses`** - one short pulse per issue, capped at `pulses.maxCount` and
  spaced by at least the safety cooldown so activations never overlap.

Compile failures are always a single binary shock regardless of mode.

### Where issues come from

- **Task exit codes** (`onDidEndTaskProcess`) detect hard failures. Only tasks
  whose name/source/type match `latexShock.build.taskFilter` (default `latex`)
  count.
- **Diagnostics** (`onDidChangeDiagnostics`, e.g. from LaTeX Workshop) are
  classified into issue categories and tallied for the scaled path.
- **Manual `.log` parsing** is available as an alternative via
  `latexShock.diagnostics.source`:
  - `diagnostics` (default) - use the Problems panel.
  - `log` - parse a LaTeX `.log` file directly (skips if none is found).
  - `auto` - parse a `.log` if one can be located, else fall back to
    diagnostics.

  With `log`/`auto`, set `latexShock.diagnostics.logPath` (supports
  `${workspaceFolder}`) to point at the log, or leave it empty to look next to
  the active document and then for the most recently modified `*.log` in the
  workspace.

## Install

Grab the latest `.vsix` from the **Nightly (Rolling)** release, then in VS Code
run **Extensions: Install from VSIX…** and pick the downloaded file. Every push
to `main` rebuilds and refreshes that release automatically. CI also attaches
the built `.vsix` as an artifact to each pull request.

## Setup

1. Install the extension.
2. Run **LaTeXShock: Set OpenShock API Token** and paste your token (stored in
   VS Code SecretStorage, never in settings).
3. Set `latexShock.connection.shockerId` to your shocker's ID.
4. (Recommended) Turn on `latexShock.dryRun` and build a document - the
   **LaTeXShock** output channel logs what *would* be sent so you can tune
   weights and curves without shocking yourself.
5. When you're happy, turn off `dryRun` and run **LaTeXShock: Enable**.

## Scaling

The weighted score maps to output through `latexShock.scaling.curve`:

| Curve         | Behavior                                                        |
| ------------- | -------------------------------------------------------------- |
| `linear`      | Output proportional to the score (up to `referenceScore`).     |
| `logarithmic` | Diminishing returns - early errors matter more than later ones.|
| `exponential` | Punishes piling up harder than a single mistake.               |
| `stepped`     | Discrete tiers defined by `scaling.stepThresholds`.            |

`scaling.target` chooses whether the score scales `power`, `duration`, or
`both`. The non-scaled dimension is held at its configured minimum, so you
control that constant via `power.min` / `duration.minMs`.

`scaling.referenceScore` is the weighted score at which scaled output saturates
to its maximum; lower it to reach full intensity sooner.

## Safety

These are enforced regardless of any other setting:

- **`latexShock.safety.hardMaxPower`** - an absolute intensity ceiling. Every
  computed intensity, including `failureOverride`, is clamped to it.
- **`latexShock.safety.cooldownMs`** - the minimum gap between activations.
  Requests inside the window are **dropped, never queued**, so a bad settings
  combination can't send back-to-back shocks.

Durations are additionally clamped to the OpenShock-safe range (300-30000 ms).

**Every setting is `application` (user) scope.** Nothing is settable via a
workspace's `.vscode/settings.json`, so a shared repository can never influence
whether or how hard a collaborator gets shocked. Application-scope settings
appear only under the User tab in the Settings UI and follow you via Settings
Sync.

## Settings reference

See the **LaTeXShock** section of VS Code Settings for the full, documented
list. Key groups: `triggers.*` (what counts), `weights.*` (per-issue severity),
`power.*` and `duration.*` (bounds), `scaling.*` (curve/target), and `safety.*`
(non-negotiable limits).

## Development

```sh
npm install
npm run compile   # or: npm run watch
npm test          # unit tests (scoring curves, classifier, log parser)
npx @vscode/vsce package   # build an installable .vsix locally
```

Press `F5` in VS Code to launch an Extension Development Host.

The scoring/curve math, the diagnostic classifier, and the `.log` parser are
pure (no `vscode` dependency at runtime) and covered by `node --test` unit
tests under `test/`. CI runs compile + tests on the current Node LTS and latest.

## License

This project is licensed under the **Do What The Fuck You Want To Public
License (WTFPL), Version 2**.

Copyright © 2026 [NamelessNanashi](https://git.NamelessNanashi.dev/)

See [LICENSE.md](LICENSE.md) for the full terms. The short version, which is
also the long version: you just do what the fuck you want to.
