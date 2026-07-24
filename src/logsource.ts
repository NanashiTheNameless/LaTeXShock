import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LatexShockConfig } from './config';
import { IssueCounts } from './patterns';
import { parseLatexLog } from './logparse';

export type ResolvedCounts =
  | { kind: 'counts'; counts: IssueCounts; from: string }
  | { kind: 'diagnostics' }
  | { kind: 'skip'; reason: string };

/**
 * Decides where the "dirty compile" issue counts come from, based on
 * `latexShock.diagnostics.source`:
 *
 * - `diagnostics` - let the controller tally the VS Code diagnostics.
 * - `log` - parse a LaTeX `.log` file; skip if none can be found.
 * - `auto` - parse the log if one is found, otherwise fall back to diagnostics.
 */
export async function resolveCounts(cfg: LatexShockConfig): Promise<ResolvedCounts> {
  if (cfg.diagnostics.source === 'diagnostics') {
    return { kind: 'diagnostics' };
  }

  const logPath = await findLogFile(cfg.diagnostics.logPath);
  if (!logPath) {
    if (cfg.diagnostics.source === 'log') {
      return { kind: 'skip', reason: 'no .log file found (diagnostics.source is "log")' };
    }
    return { kind: 'diagnostics' };
  }

  try {
    const content = await fs.readFile(logPath, 'utf8');
    return { kind: 'counts', counts: parseLatexLog(content), from: logPath };
  } catch (err) {
    const reason = `failed to read ${logPath}: ${err instanceof Error ? err.message : String(err)}`;
    if (cfg.diagnostics.source === 'log') {
      return { kind: 'skip', reason };
    }
    return { kind: 'diagnostics' };
  }
}

function firstWorkspaceFolder(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Locates a `.log` file to parse, in priority order:
 *  1. An explicit `diagnostics.logPath` (with `${workspaceFolder}` expanded).
 *  2. A sibling `.log` next to the active editor's document.
 *  3. The most recently modified `*.log` in the workspace.
 */
async function findLogFile(configuredPath: string): Promise<string | undefined> {
  const folder = firstWorkspaceFolder();

  if (configuredPath.trim() !== '') {
    let p = configuredPath.replace(/\$\{workspaceFolder\}/g, folder ?? '');
    if (!path.isAbsolute(p) && folder) {
      p = path.join(folder, p);
    }
    return (await exists(p)) ? p : undefined;
  }

  const active = vscode.window.activeTextEditor?.document.uri;
  if (active && active.scheme === 'file') {
    const sibling = active.fsPath.replace(/\.[^.]+$/, '.log');
    if (sibling !== active.fsPath && (await exists(sibling))) {
      return sibling;
    }
  }

  return findMostRecentLog();
}

async function findMostRecentLog(): Promise<string | undefined> {
  const uris = await vscode.workspace.findFiles('**/*.log', '**/node_modules/**', 50);
  let best: { path: string; mtimeMs: number } | undefined;
  for (const uri of uris) {
    if (uri.scheme !== 'file') {
      continue;
    }
    try {
      const stat = await fs.stat(uri.fsPath);
      if (!best || stat.mtimeMs > best.mtimeMs) {
        best = { path: uri.fsPath, mtimeMs: stat.mtimeMs };
      }
    } catch {
      /* ignore unreadable candidates */
    }
  }
  return best?.path;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
