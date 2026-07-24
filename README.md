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
language whose tooling populates the Problems panel - set
`latexShock.diagnostics.includeNonLatexFiles` to opt into that.

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
- **Diagnostics** (e.g. from LaTeX Workshop) are classified into issue
  categories and tallied for the scaled path. Three rules keep this from
  turning your editor into a shock collar:
  - Only **`Error`** and **`Warning`** severities count. `Information` and
    `Hint` are ignored, because spell-checkers and style linters emit those in
    bulk - a document with 14 "Unknown word" hints is not a broken build.
  - Only **LaTeX source files** count (`.tex`, `.ltx`, `.bib`, `.sty`, `.cls`,
    `.dtx`, `.ins`), unless you set
    `latexShock.diagnostics.includeNonLatexFiles`.
  - Evaluation runs only after a **matching build task finishes**. Set
    `latexShock.diagnostics.evaluateOn` to `anyChange` if your builder never
    runs as a VS Code task (LaTeX Workshop's internal build, for instance) -
    but be aware diagnostics change constantly as you type.

  On top of that, an evaluation whose counts are **identical to the previous
  one** is skipped, so a static set of warnings shocks once rather than every
  cooldown window. A finished build task always counts as a new result.
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

This extension is not on the Marketplace; install the `.vsix` directly.

### Get the `.vsix`

- **Nightly (Rolling) release** (recommended) - grab the latest `.vsix` from the
  [Nightly (Rolling)](https://github.com/NanashiTheNameless/LaTeXShock/releases/tag/Nightly-Rolling)
  release. Every push to `main` rebuilds and refreshes it automatically.

  That release also carries **`latexshock-latest.vsix`**, a stable filename that
  always holds the newest build, so this URL never changes:

  ```sh
  curl -LO https://github.com/NanashiTheNameless/LaTeXShock/releases/download/Nightly-Rolling/latexshock-latest.vsix
  ```

  The timestamped `latexshock-<date>.vsix` assets alongside it are the previous
  few builds, kept for rollback.
- **Per-PR artifact** - CI attaches the built `.vsix` as an artifact to each
  pull request, under the run's **Artifacts** section.
- **Build it yourself** - see [Development](#development) below.

### Install the `.vsix`

**From the UI:**

1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Click the `…` menu at the top of the panel.
3. Choose **Install from VSIX…** and pick the downloaded file.
4. Reload the window if prompted.

**From the command line:**

```sh
code --install-extension latexshock.vsix
# VSCodium:
codium --install-extension latexshock.vsix
```

After installing, continue to [Setup](#setup) - the extension ships **disabled**
and does nothing until you configure and enable it.

## Using the extension

Everything is driven by two pieces of VS Code UI: the **Command Palette** (for
one-off actions) and **Settings** (for how hard it hits).

### The Command Palette

The Command Palette is how you run every LaTeXShock command.

- **Open it:** `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS). `F1`
  works too, as does **View → Command Palette…** in the menu bar.
- **Use it:** start typing `LaTeXShock` - the list filters as you type. Use
  `↑`/`↓` to pick a command and `Enter` to run it. `Esc` closes it without
  running anything.

If nothing matches, the extension isn't installed or isn't active yet; check
**Extensions** (`Ctrl+Shift+X` / `Cmd+Shift+X`) for LaTeXShock.

### Commands

| Command                                   | What it does                                               |
| ----------------------------------------- | ---------------------------------------------------------- |
| **LaTeXShock: Set OpenShock API Token**   | Prompts for your token; stores it in SecretStorage.        |
| **LaTeXShock: Clear OpenShock API Token** | Deletes the stored token. Nothing can be sent without one. |
| **LaTeXShock: Send Test Shock**           | Fires a fixed power-1, 300 ms shock. Ignores `enabled`.    |
| **LaTeXShock: Enable**                    | Sets `latexShock.enabled` to `true`.                       |
| **LaTeXShock: Disable**                   | Sets `latexShock.enabled` to `false`.                      |
| **LaTeXShock: Show Log**                  | Reveals the live output channel.                           |
| **LaTeXShock: Open Log File**             | Opens the on-disk log in an editor.                        |

### Changing settings

- **Open Settings:** `Ctrl+,` (Windows/Linux) or `Cmd+,` (macOS), or
  **File → Preferences → Settings**.
- Search for `latexShock` and stay on the **User** tab - every setting is
  application-scoped, so the Workspace tab won't offer them (see [Safety](#safety)).
- Prefer editing JSON? Run **Preferences: Open User Settings (JSON)** from the
  Command Palette and add keys like `"latexShock.power.max": 60`.

## Setup

1. **Install the extension** (see [Install](#install)).
2. **Store your API token.** Open the Command Palette and run **LaTeXShock: Set
   OpenShock API Token**, then paste your OpenShock token and press `Enter`. It
   goes into VS Code SecretStorage, never into settings, and never into a file
   you might commit.
3. **Set your shocker ID.** In Settings, search `latexShock.connection.shockerId`
   and paste the ID of the shocker you want to fire.
4. **Prove the connection works.** Run **LaTeXShock: Send Test Shock**. It's
   fixed at intensity 1 for 300 ms and works whether or not the extension is
   enabled. If nothing happens, run **LaTeXShock: Show Log** - a missing token or
   shocker ID is reported there.
5. **Dry-run first (recommended).** Turn on `latexShock.dryRun`, then build a
   document. The log shows what *would* have been sent, so you can tune
   `weights.*`, `scaling.*`, `power.*`, and `duration.*` without being shocked
   for your own configuration mistakes.
6. **Go live.** Turn off `dryRun` and run **LaTeXShock: Enable**. Builds now
   trigger real shocks.

To stop it at any point, run **LaTeXShock: Disable**. To stop it permanently and
completely, also run **LaTeXShock: Clear OpenShock API Token**.

### Day to day

Once enabled, there's nothing to run - the extension watches build tasks and the
Problems panel on its own. Build your document as usual and it reacts:

- Build task exits non-zero → one full-strength shock (`power.failureOverride`).
- Build succeeds with warnings → a scaled shock (or a pulse train in
  `pulses` mode), sized by the weighted severity score.
- Build is clean → nothing.

If a build produced something you didn't expect, **LaTeXShock: Show Log** shows
the counts, the score, and the resulting power/duration for every decision.

## Logging

Every decision the extension makes is logged twice:

- **Live** - the **LaTeXShock** output channel, via **LaTeXShock: Show Log**.
- **On disk** - a timestamped `latexshock.log` in the window session's extension
  log directory, opened with **LaTeXShock: Open Log File**. The path is also
  printed at the top of the output channel on activation.

The file survives a closed panel or a reloaded window, so what was actually sent
to a real device stays auditable after the fact. VS Code allocates a fresh log
directory per window session, so the file rotates on its own.

## Scaling

The weighted score maps to output through `latexShock.scaling.curve`:

| Curve         | Behavior                                                        |
| ------------- | --------------------------------------------------------------- |
| `linear`      | Output proportional to the score (up to `referenceScore`).      |
| `logarithmic` | Diminishing returns - early errors matter more than later ones. |
| `exponential` | Punishes piling up harder than a single mistake.                |
| `stepped`     | Discrete tiers defined by `scaling.stepThresholds`.             |

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

Durations are additionally clamped to the OpenShock-safe range (300-65535 ms).

**`latexShock.enabled` gates *automatic* shocks only.** **LaTeXShock: Send Test
Shock** is an explicit, user-initiated action and fires whether the extension is
enabled or not. Its output is **hard-coded to intensity 1 for 300 ms** - the
lowest non-zero intensity and the shortest duration OpenShock accepts, ignoring
`power.*` and `duration.*` entirely - so proving your connection works can't be
made painful by a mistuned setting. It still obeys `dryRun`, the cooldown, and
`hardMaxPower`. If you want to be certain nothing can fire, leave `dryRun` on or
clear your API token.

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

This project uses **Yarn Berry** (Yarn 4). Enable it via Corepack:

```sh
corepack enable
yarn install
yarn compile   # or: yarn watch
yarn test      # unit tests (scoring curves, classifier, log parser)
npx @vscode/vsce package --no-yarn   # build an installable .vsix locally
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
