import * as vscode from 'vscode';

/**
 * The issue categories that contribute to a scaled "compiled but dirty" score.
 * Compile failure is handled separately as a binary event.
 */
export type IssueCategory =
  | 'undefinedReferences'
  | 'overfullHbox'
  | 'underfullHbox'
  | 'packageWarnings'
  | 'fontWarnings';

export type ScalingCurve = 'linear' | 'logarithmic' | 'exponential' | 'stepped';
export type ScalingTarget = 'power' | 'duration' | 'both';
export type ReactionMode = 'scaled' | 'pulses';
export type DiagnosticsSource = 'diagnostics' | 'log' | 'auto';

export interface LatexShockConfig {
  enabled: boolean;
  dryRun: boolean;
  mode: ReactionMode;
  connection: {
    apiBaseUrl: string;
    shockerId: string;
  };
  build: {
    taskFilter: string;
  };
  diagnostics: {
    source: DiagnosticsSource;
    logPath: string;
  };
  triggers: {
    compileFailure: boolean;
    undefinedReferences: boolean;
    overfullHbox: boolean;
    underfullHbox: boolean;
    packageWarnings: boolean;
    fontWarnings: boolean;
  };
  weights: {
    compileFailure: number;
    undefinedReference: number;
    overfullHbox: number;
    underfullHbox: number;
    packageWarning: number;
    fontWarning: number;
  };
  power: {
    min: number;
    max: number;
    failureOverride: number;
  };
  duration: {
    minMs: number;
    maxMs: number;
    failureMs: number;
  };
  scaling: {
    curve: ScalingCurve;
    target: ScalingTarget;
    referenceScore: number;
    stepThresholds: number[];
  };
  pulses: {
    intensity: number;
    durationMs: number;
    maxCount: number;
    spacingMs: number;
  };
  safety: {
    hardMaxPower: number;
    cooldownMs: number;
  };
}

/**
 * Reads the fully-typed configuration from the `latexShock.*` namespace.
 *
 * Every setting is `application` scope, so this only ever reflects the user's
 * own settings - a workspace's `.vscode/settings.json` can never influence
 * whether or how hard a collaborator gets shocked.
 */
export function readConfig(): LatexShockConfig {
  const c = vscode.workspace.getConfiguration('latexShock');
  return {
    enabled: c.get<boolean>('enabled', false),
    dryRun: c.get<boolean>('dryRun', false),
    mode: c.get<ReactionMode>('mode', 'scaled'),
    connection: {
      apiBaseUrl: c.get<string>('connection.apiBaseUrl', 'https://api.openshock.app'),
      shockerId: c.get<string>('connection.shockerId', ''),
    },
    build: {
      taskFilter: c.get<string>('build.taskFilter', 'latex'),
    },
    diagnostics: {
      source: c.get<DiagnosticsSource>('diagnostics.source', 'diagnostics'),
      logPath: c.get<string>('diagnostics.logPath', ''),
    },
    triggers: {
      compileFailure: c.get<boolean>('triggers.compileFailure', true),
      undefinedReferences: c.get<boolean>('triggers.undefinedReferences', true),
      overfullHbox: c.get<boolean>('triggers.overfullHbox', false),
      underfullHbox: c.get<boolean>('triggers.underfullHbox', false),
      packageWarnings: c.get<boolean>('triggers.packageWarnings', true),
      fontWarnings: c.get<boolean>('triggers.fontWarnings', false),
    },
    weights: {
      compileFailure: c.get<number>('weights.compileFailure', 100),
      undefinedReference: c.get<number>('weights.undefinedReference', 15),
      overfullHbox: c.get<number>('weights.overfullHbox', 3),
      underfullHbox: c.get<number>('weights.underfullHbox', 2),
      packageWarning: c.get<number>('weights.packageWarning', 5),
      fontWarning: c.get<number>('weights.fontWarning', 2),
    },
    power: {
      min: c.get<number>('power.min', 10),
      max: c.get<number>('power.max', 80),
      failureOverride: c.get<number>('power.failureOverride', 100),
    },
    duration: {
      minMs: c.get<number>('duration.minMs', 500),
      maxMs: c.get<number>('duration.maxMs', 5000),
      failureMs: c.get<number>('duration.failureMs', 3000),
    },
    scaling: {
      curve: c.get<ScalingCurve>('scaling.curve', 'linear'),
      target: c.get<ScalingTarget>('scaling.target', 'power'),
      referenceScore: c.get<number>('scaling.referenceScore', 100),
      stepThresholds: c.get<number[]>('scaling.stepThresholds', [1, 3, 6, 10]),
    },
    pulses: {
      intensity: c.get<number>('pulses.intensity', 20),
      durationMs: c.get<number>('pulses.durationMs', 300),
      maxCount: c.get<number>('pulses.maxCount', 5),
      spacingMs: c.get<number>('pulses.spacingMs', 5000),
    },
    safety: {
      hardMaxPower: c.get<number>('safety.hardMaxPower', 100),
      cooldownMs: c.get<number>('safety.cooldownMs', 5000),
    },
  };
}
