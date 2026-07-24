import * as vscode from 'vscode';
import { readConfig } from './config';
import { Controller, TOKEN_KEY } from './controller';
import { resolveCounts } from './logsource';

/**
 * Debounce window for diagnostic-driven evaluation. LaTeX Workshop (and most
 * linters) rewrite diagnostics in bursts after a build, so we wait for them to
 * settle before scoring. The safety cooldown dedupes anything that slips past.
 */
const DIAGNOSTIC_DEBOUNCE_MS = 1500;

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('LaTeXShock');
  const controller = new Controller(context.secrets, log);
  log.appendLine('LaTeXShock activated.');

  const evaluateDirty = async () => {
    const cfg = readConfig();
    const resolved = await resolveCounts(cfg);
    if (resolved.kind === 'skip') {
      log.appendLine(`[dirty] skipped: ${resolved.reason}`);
      return;
    }
    if (resolved.kind === 'counts') {
      log.appendLine(`[dirty] using parsed log: ${resolved.from}`);
      await controller.onDirtyCompile(resolved.counts);
    } else {
      await controller.onDirtyCompile();
    }
  };

  let debounceTimer: NodeJS.Timeout | undefined;
  const scheduleDirtyEvaluation = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void evaluateDirty();
    }, DIAGNOSTIC_DEBOUNCE_MS);
  };

  // 1. Build task exit codes -> compile failure (non-zero) or a dirty-compile
  //    evaluation (zero). Only tasks matching build.taskFilter are considered.
  const taskListener = vscode.tasks.onDidEndTaskProcess((event) => {
    const cfg = readConfig();
    if (!cfg.enabled) {
      return;
    }
    if (!taskMatches(event.execution.task, cfg.build.taskFilter)) {
      return;
    }
    const code = event.exitCode ?? 0;
    if (code !== 0) {
      log.appendLine(`[task] "${event.execution.task.name}" exited ${code} -> failure`);
      void controller.onCompileFailure();
    } else {
      log.appendLine(`[task] "${event.execution.task.name}" exited 0 -> evaluate diagnostics`);
      // Give the build's diagnostics a moment to land before scoring.
      scheduleDirtyEvaluation();
    }
  });

  // 2. Fallback for tools that don't run as VS Code tasks (e.g. LaTeX
  //    Workshop's internal build): react to diagnostic changes directly.
  const diagnosticsListener = vscode.languages.onDidChangeDiagnostics(() => {
    const cfg = readConfig();
    if (!cfg.enabled) {
      return;
    }
    scheduleDirtyEvaluation();
  });

  context.subscriptions.push(
    log,
    taskListener,
    diagnosticsListener,
    vscode.commands.registerCommand('latexShock.setToken', () => setToken(context, log)),
    vscode.commands.registerCommand('latexShock.clearToken', () => clearToken(context, log)),
    vscode.commands.registerCommand('latexShock.testShock', () => controller.onTestShock()),
    vscode.commands.registerCommand('latexShock.enable', () => setEnabled(true)),
    vscode.commands.registerCommand('latexShock.disable', () => setEnabled(false)),
    vscode.commands.registerCommand('latexShock.showOutput', () => log.show()),
  );
}

export function deactivate(): void {
  /* nothing to clean up beyond the disposables tracked in subscriptions */
}

function taskMatches(task: vscode.Task, filter: string): boolean {
  let re: RegExp;
  try {
    re = new RegExp(filter, 'i');
  } catch {
    // A bad user-supplied regex shouldn't crash the listener; match nothing.
    return false;
  }
  const haystacks = [task.name, task.source, task.definition?.type ?? ''];
  return haystacks.some((h) => typeof h === 'string' && re.test(h));
}

async function setToken(context: vscode.ExtensionContext, log: vscode.OutputChannel): Promise<void> {
  const token = await vscode.window.showInputBox({
    title: 'OpenShock API Token',
    prompt: 'Stored securely in VS Code SecretStorage, never in settings.',
    password: true,
    ignoreFocusOut: true,
  });
  if (token === undefined) {
    return;
  }
  if (token.trim() === '') {
    void vscode.window.showWarningMessage('LaTeXShock: token was empty; nothing saved.');
    return;
  }
  await context.secrets.store(TOKEN_KEY, token.trim());
  log.appendLine('[token] stored');
  void vscode.window.showInformationMessage('LaTeXShock: OpenShock API token saved.');
}

async function clearToken(
  context: vscode.ExtensionContext,
  log: vscode.OutputChannel,
): Promise<void> {
  await context.secrets.delete(TOKEN_KEY);
  log.appendLine('[token] cleared');
  void vscode.window.showInformationMessage('LaTeXShock: OpenShock API token cleared.');
}

async function setEnabled(value: boolean): Promise<void> {
  await vscode.workspace
    .getConfiguration('latexShock')
    .update('enabled', value, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(`LaTeXShock: ${value ? 'enabled' : 'disabled'}.`);
}
