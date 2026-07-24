import { LatexShockConfig } from './config';
import { CATEGORIES, IssueCounts } from './patterns';

export interface ShockPlan {
  /** Final intensity, 0-100, after curve, bounds and the safety ceiling. */
  power: number;
  /** Final duration in milliseconds, clamped to the OpenShock-safe range. */
  durationMs: number;
  /** The weighted severity score the plan was derived from. */
  score: number;
  /** Human-readable summary for logging. */
  reason: string;
}

const OPENSHOCK_MIN_MS = 300;
const OPENSHOCK_MAX_MS = 65535;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Weighted severity score from per-category counts, honoring which triggers
 * are enabled. Disabled categories contribute nothing.
 */
export function weightedScore(counts: IssueCounts, cfg: LatexShockConfig): number {
  let score = 0;
  for (const { category, weightKey } of CATEGORIES) {
    if (cfg.triggers[category]) {
      score += counts[category] * cfg.weights[weightKey];
    }
  }
  return score;
}

/**
 * Number of individual issues in enabled categories, ignoring weights. Used by
 * the sequenced-pulse mode to decide how many discrete pulses to emit.
 */
export function enabledIssueCount(counts: IssueCounts, cfg: LatexShockConfig): number {
  let n = 0;
  for (const { category } of CATEGORIES) {
    if (cfg.triggers[category]) {
      n += counts[category];
    }
  }
  return n;
}

/**
 * How many discrete pulses to emit for a dirty compile in `pulses` mode: one
 * per enabled issue, capped at `pulses.maxCount` (and never negative).
 */
export function pulseCount(counts: IssueCounts, cfg: LatexShockConfig): number {
  const cap = Math.max(0, Math.floor(cfg.pulses.maxCount));
  return Math.min(cap, enabledIssueCount(counts, cfg));
}

/**
 * Maps a raw weighted score to a normalized fraction in [0, 1] according to
 * the configured scaling curve. `referenceScore` is the score at which output
 * saturates to 1.
 */
export function normalize(score: number, cfg: LatexShockConfig): number {
  const ref = Math.max(1, cfg.scaling.referenceScore);
  switch (cfg.scaling.curve) {
    case 'logarithmic': {
      // Diminishing returns: early errors move the needle more than later ones.
      return clamp(Math.log1p(score) / Math.log1p(ref), 0, 1);
    }
    case 'exponential': {
      // Punish piling up: a small score stays gentle, a large one ramps hard.
      return clamp(Math.pow(clamp(score / ref, 0, 1), 2), 0, 1);
    }
    case 'stepped': {
      // Discrete tiers. Each crossed threshold advances one step toward max.
      const thresholds = [...cfg.scaling.stepThresholds].sort((a, b) => a - b);
      if (thresholds.length === 0) {
        return score > 0 ? 1 : 0;
      }
      let crossed = 0;
      for (const threshold of thresholds) {
        if (score >= threshold) {
          crossed += 1;
        }
      }
      return clamp(crossed / thresholds.length, 0, 1);
    }
    case 'linear':
    default:
      return clamp(score / ref, 0, 1);
  }
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/**
 * Builds the shock plan for a scaled "compiled but dirty" event.
 * Returns `null` when the score is zero (nothing to react to).
 */
export function planDirty(counts: IssueCounts, cfg: LatexShockConfig): ShockPlan | null {
  const score = weightedScore(counts, cfg);
  if (score <= 0) {
    return null;
  }
  const t = normalize(score, cfg);
  const target = cfg.scaling.target;

  const scalesPower = target === 'power' || target === 'both';
  const scalesDuration = target === 'duration' || target === 'both';

  // The non-scaled dimension is held at its configured minimum, so the user
  // controls the constant value through power.min / duration.minMs.
  const power = scalesPower ? lerp(cfg.power.min, cfg.power.max, t) : cfg.power.min;
  const durationMs = scalesDuration
    ? lerp(cfg.duration.minMs, cfg.duration.maxMs, t)
    : cfg.duration.minMs;

  return finalize(power, durationMs, score, cfg, `dirty compile, score ${score}, t=${t.toFixed(2)}`);
}

/**
 * Builds the shock plan for a hard compile failure - a binary event that
 * ignores the curve math and uses the failure overrides.
 */
export function planFailure(cfg: LatexShockConfig): ShockPlan {
  return finalize(
    cfg.power.failureOverride,
    cfg.duration.failureMs,
    cfg.weights.compileFailure,
    cfg,
    'compile failure (binary event)',
  );
}

function finalize(
  power: number,
  durationMs: number,
  score: number,
  cfg: LatexShockConfig,
  reason: string,
): ShockPlan {
  const cappedPower = clamp(Math.round(power), 0, clamp(cfg.safety.hardMaxPower, 0, 100));
  const cappedDuration = clamp(Math.round(durationMs), OPENSHOCK_MIN_MS, OPENSHOCK_MAX_MS);
  return {
    power: cappedPower,
    durationMs: cappedDuration,
    score,
    reason,
  };
}
