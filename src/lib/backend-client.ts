import { fetch } from 'undici';

const CLI_VERSION = '0.1.0';
const DEFAULT_TIMEOUT_MS = 10_000;

export class BackendError extends Error {
  readonly status?: number;
  readonly code: 'unauthorized' | 'network' | 'timeout' | 'bad_response' | 'server_error';
  constructor(
    code: BackendError['code'],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.status = status;
  }
}

export interface ValidateTokenInput {
  backend: string;
  token: string;
  timeoutMs?: number;
}

export interface ValidateTokenResult {
  ok: true;
  username: string;
  userId: string;
}

function joinUrl(base: string, p: string): string {
  return base.replace(/\/+$/, '') + p;
}

export async function validateToken(
  input: ValidateTokenInput,
): Promise<ValidateTokenResult> {
  const { backend, token } = input;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(joinUrl(backend, '/cli/validate-token'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': `copilot-otel-cli/${CLI_VERSION}`,
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort =
      typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
    if (isAbort) {
      throw new BackendError('timeout', `Request to ${backend} timed out after ${timeoutMs}ms.`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new BackendError('network', `Network error contacting backend: ${msg}`);
  }
  clearTimeout(timer);

  if (res.status === 401) {
    throw new BackendError('unauthorized', 'Token rejected by backend (401).', 401);
  }
  if (res.status >= 500) {
    throw new BackendError('server_error', `Backend returned ${res.status}.`, res.status);
  }
  if (!res.ok) {
    throw new BackendError('bad_response', `Unexpected status ${res.status}.`, res.status);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new BackendError('bad_response', `Backend returned non-JSON body: ${msg}`, res.status);
  }

  if (
    !body ||
    typeof body !== 'object' ||
    (body as { ok?: unknown }).ok !== true ||
    typeof (body as { username?: unknown }).username !== 'string' ||
    typeof (body as { userId?: unknown }).userId !== 'string'
  ) {
    throw new BackendError('bad_response', 'Backend response missing expected fields.');
  }

  const typed = body as { ok: true; username: string; userId: string };
  return { ok: true, username: typed.username, userId: typed.userId };
}
