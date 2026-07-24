/**
 * Minimal OpenShock API client.
 *
 * Uses the v2 control endpoint (`POST /2/shockers/control`). Intensity is an
 * integer 1-100 and duration is milliseconds (the API accepts roughly
 * 300-65535ms). Authentication is via the `OpenShockToken` header.
 */

export interface ShockRequest {
  shockerId: string;
  /** 1-100. */
  intensity: number;
  /** Milliseconds. */
  durationMs: number;
}

export interface OpenShockClientOptions {
  baseUrl: string;
  token: string;
}

export class OpenShockError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OpenShockError';
  }
}

export class OpenShockClient {
  constructor(private readonly options: OpenShockClientOptions) {}

  async shock(req: ShockRequest): Promise<void> {
    const intensity = Math.max(1, Math.min(100, Math.round(req.intensity)));
    const duration = Math.max(300, Math.min(65535, Math.round(req.durationMs)));
    const url = `${this.options.baseUrl.replace(/\/+$/, '')}/2/shockers/control`;

    const body = {
      shocks: [
        {
          id: req.shockerId,
          type: 'Shock',
          intensity,
          duration,
          exclusive: true,
        },
      ],
      customName: 'LaTeXShock',
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          OpenShockToken: this.options.token,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new OpenShockError(
        `Network error contacting OpenShock: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        /* ignore body read failures */
      }
      throw new OpenShockError(
        `OpenShock API returned ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`,
        response.status,
      );
    }
  }
}
