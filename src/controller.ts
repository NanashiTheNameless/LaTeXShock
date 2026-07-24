import * as vscode from 'vscode';
import { LatexShockConfig, readConfig } from './config';
import { IssueCounts, tally, latexDiagnosticUris } from './classify';
import { planDirty, planFailure, pulseCount, ShockPlan } from './scoring';
import { OpenShockClient, OpenShockError } from './openshock';
import { Logger } from './logger';

export const TOKEN_KEY = 'latexShock.openShockToken';

/**
 * Intensity and duration of the manual test shock. Fixed, not configurable:
 * the command exists to prove the connection works, so it must stay harmless
 * no matter how the power and duration settings are tuned. 300 ms is the
 * shortest duration OpenShock accepts.
 */
const TEST_SHOCK_POWER = 1;
const TEST_SHOCK_DURATION_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Owns the runtime behavior: turns build/diagnostic events into shock plans,
 * enforces the safety cooldown, and dispatches to the OpenShock API (or logs
 * in dry-run mode).
 */
export class Controller {
  private lastActivation = 0;
  private pulseRunning = false;
  /**
   * Counts of the last dirty-compile evaluation, used to ignore repeat
   * evaluations. Diagnostics are rewritten constantly (on save, on keystroke,
   * whenever any linter re-runs), and without this an unchanged set of
   * warnings shocks again every cooldown window.
   */
  private lastDirtySignature: string | undefined;

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly log: Logger,
  ) {}

  /** A hard compile failure - binary event, uses the failure overrides. */
  async onCompileFailure(): Promise<void> {
    const cfg = readConfig();
    if (!this.gate(cfg.enabled)) {
      return;
    }
    if (!cfg.triggers.compileFailure) {
      this.log.appendLine('[failure] ignored: triggers.compileFailure is off');
      return;
    }
    await this.dispatch(planFailure(cfg), cfg.dryRun, cfg.connection, cfg.safety.cooldownMs);
  }

  /**
   * A compile that produced output but has diagnostics. Depending on
   * `latexShock.mode` this is either a single scaled shock or a sequence of
   * discrete pulses (one per issue, capped).
   *
   * Repeat evaluations that produce identical counts are ignored, so only a
   * *change* in the problem set can shock. Pass `force` for an unambiguous new
   * build result (a finished build task), which should fire even if the
   * resulting counts happen to match the previous build's.
   */
  async onDirtyCompile(counts?: IssueCounts, options?: { force?: boolean }): Promise<void> {
    const cfg = readConfig();
    if (!this.gate(cfg.enabled)) {
      return;
    }
    const resolved = counts ?? tally(latexDiagnosticUris(cfg.diagnostics.includeNonLatexFiles));

    const signature = JSON.stringify(resolved);
    if (!options?.force && signature === this.lastDirtySignature) {
      this.log.appendLine('[dirty] counts unchanged since the last evaluation; skipping');
      return;
    }
    this.lastDirtySignature = signature;

    if (cfg.mode === 'pulses') {
      await this.runPulses(resolved, cfg);
      return;
    }

    const plan = planDirty(resolved, cfg);
    if (!plan) {
      this.log.appendLine('[dirty] no scorable issues; nothing to do');
      return;
    }
    this.log.appendLine(
      `[dirty] counts=${JSON.stringify(resolved)} -> power=${plan.power} duration=${plan.durationMs}ms`,
    );
    await this.dispatch(plan, cfg.dryRun, cfg.connection, cfg.safety.cooldownMs);
  }

  /**
   * Sequenced-pulse mode: emit one short pulse per enabled issue, capped at
   * `pulses.maxCount`, spaced by at least the safety cooldown so activations
   * never overlap. Only one batch runs at a time.
   */
  private async runPulses(counts: IssueCounts, cfg: LatexShockConfig): Promise<void> {
    const count = pulseCount(counts, cfg);
    if (count <= 0) {
      this.log.appendLine('[pulses] no scorable issues; nothing to do');
      return;
    }
    if (this.pulseRunning) {
      this.log.appendLine('[pulses] a pulse batch is already running; skipping');
      return;
    }

    const spacing = Math.max(cfg.pulses.spacingMs, cfg.safety.cooldownMs);
    const power = Math.min(cfg.pulses.intensity, cfg.safety.hardMaxPower);
    this.log.appendLine(
      `[pulses] ${count} pulse(s) at power=${power} duration=${cfg.pulses.durationMs}ms spacing=${spacing}ms`,
    );

    this.pulseRunning = true;
    try {
      for (let i = 0; i < count; i += 1) {
        const plan: ShockPlan = {
          power,
          durationMs: cfg.pulses.durationMs,
          score: 0,
          reason: `pulse ${i + 1}/${count}`,
        };
        await this.dispatch(plan, cfg.dryRun, cfg.connection, cfg.safety.cooldownMs);
        if (i < count - 1) {
          await delay(spacing);
        }
      }
    } finally {
      this.pulseRunning = false;
    }
  }

  /**
   * A manual test shock, hard-coded to the lowest non-zero intensity and the
   * shortest allowed duration so that "does my wiring work?" can never be
   * answered painfully by misconfigured power/duration settings. Deliberately
   * ignores `latexShock.enabled`: it is an explicit, user-initiated action, and
   * the master switch exists to stop *automatic* shocks. Still respects
   * dry-run, the cooldown, and the safety ceiling.
   */
  async onTestShock(): Promise<void> {
    const cfg = readConfig();
    if (!cfg.enabled) {
      this.log.appendLine('[test] latexShock.enabled is off, but a test shock was requested');
    }
    const plan: ShockPlan = {
      power: Math.min(TEST_SHOCK_POWER, cfg.safety.hardMaxPower),
      durationMs: TEST_SHOCK_DURATION_MS,
      score: 0,
      reason: 'manual test shock',
    };
    await this.dispatch(plan, cfg.dryRun, cfg.connection, cfg.safety.cooldownMs);
  }

  private gate(enabled: boolean): boolean {
    if (!enabled) {
      this.log.appendLine('[gate] latexShock.enabled is off; skipping');
      return false;
    }
    return true;
  }

  private async dispatch(
    plan: ShockPlan,
    dryRun: boolean,
    connection: { apiBaseUrl: string; shockerId: string },
    cooldownMs: number,
  ): Promise<void> {
    const now = Date.now();
    const sinceLast = now - this.lastActivation;
    if (sinceLast < cooldownMs) {
      this.log.appendLine(
        `[cooldown] dropped (${sinceLast}ms since last, need ${cooldownMs}ms): ${plan.reason}`,
      );
      return;
    }

    if (dryRun) {
      this.lastActivation = now;
      this.log.appendLine(
        `[dry-run] would shock power=${plan.power} duration=${plan.durationMs}ms (${plan.reason})`,
      );
      return;
    }

    const token = await this.secrets.get(TOKEN_KEY);
    if (!token) {
      this.log.appendLine('[error] no API token set; run "LaTeXShock: Set OpenShock API Token"');
      void vscode.window.showWarningMessage(
        'LaTeXShock: no OpenShock API token is set. Run "LaTeXShock: Set OpenShock API Token".',
      );
      return;
    }
    if (!connection.shockerId) {
      this.log.appendLine('[error] no shocker ID configured (latexShock.connection.shockerId)');
      void vscode.window.showWarningMessage(
        'LaTeXShock: no shocker ID is configured (latexShock.connection.shockerId).',
      );
      return;
    }

    // Reserve the cooldown window before the await so overlapping events can't
    // slip a second activation through while this request is in flight.
    this.lastActivation = now;
    const client = new OpenShockClient({ baseUrl: connection.apiBaseUrl, token });
    try {
      await client.shock({
        shockerId: connection.shockerId,
        intensity: plan.power,
        durationMs: plan.durationMs,
      });
      this.log.appendLine(
        `[shock] sent power=${plan.power} duration=${plan.durationMs}ms (${plan.reason})`,
      );
    } catch (err) {
      const msg = err instanceof OpenShockError ? err.message : String(err);
      this.log.appendLine(`[error] ${msg}`);
      void vscode.window.showErrorMessage(`LaTeXShock: ${msg}`);
    }
  }
}
