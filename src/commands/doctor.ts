import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse as parseJsonc } from 'jsonc-parser';
import kleur from 'kleur';
import { readConfig } from '../lib/config.js';
import {
  LAUNCH_AGENT_LABEL,
  LAUNCH_AGENT_PATH,
  OTEL_HEADERS_ENV,
  VSCODE_KEYS,
} from '../lib/paths.js';
import { BackendError, validateToken } from '../lib/backend-client.js';

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  hint?: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function tryExec(file: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(file, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { ok: true, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      ok: false,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

export async function runDoctor(): Promise<void> {
  const results: CheckResult[] = [];

  // 1) Config file.
  const cfg = await readConfig().catch((err: Error) => {
    results.push({
      name: 'config file parses',
      ok: false,
      detail: err.message,
      hint: 'Re-run `copilot-otel init` to regenerate ~/.copilot-otel/config.json',
    });
    return null;
  });
  if (cfg) {
    results.push({ name: 'config file exists & parses', ok: true, detail: cfg.backendUrl });
  } else if (!results.some((r) => r.name === 'config file parses')) {
    results.push({
      name: 'config file exists',
      ok: false,
      hint: 'Run `copilot-otel init` first.',
    });
  }

  // 2) VS Code settings keys.
  if (cfg) {
    for (const settingsPath of cfg.vscodePaths) {
      const exists = await pathExists(settingsPath);
      if (!exists) {
        results.push({
          name: `settings.json: ${settingsPath}`,
          ok: false,
          hint: 'Re-run `copilot-otel init`.',
        });
        continue;
      }
      try {
        const raw = await fs.readFile(settingsPath, 'utf8');
        const parsed = parseJsonc(raw) ?? {};
        const missing: string[] = [];
        for (const key of Object.values(VSCODE_KEYS)) {
          if (parsed[key] === undefined) missing.push(key);
        }
        if (missing.length === 0) {
          results.push({
            name: `VS Code settings keys present (${settingsPath})`,
            ok: true,
          });
        } else {
          results.push({
            name: `VS Code settings keys present (${settingsPath})`,
            ok: false,
            detail: `missing: ${missing.join(', ')}`,
            hint: 'Re-run `copilot-otel init --force`.',
          });
        }
      } catch (err: unknown) {
        results.push({
          name: `VS Code settings parse (${settingsPath})`,
          ok: false,
          detail: (err as Error).message,
        });
      }
    }
  }

  // 3) LaunchAgent plist exists.
  const plistExists = await pathExists(LAUNCH_AGENT_PATH);
  results.push({
    name: `LaunchAgent plist at ${LAUNCH_AGENT_PATH}`,
    ok: plistExists,
    hint: plistExists ? undefined : 'Run `copilot-otel init`.',
  });

  // 4) launchctl print.
  let uid = 0;
  if (typeof process.getuid === 'function') uid = process.getuid();
  const printRes = tryExec('/bin/launchctl', ['print', `gui/${uid}/${LAUNCH_AGENT_LABEL}`]);
  results.push({
    name: 'LaunchAgent loaded (launchctl print)',
    ok: printRes.ok,
    hint: printRes.ok
      ? undefined
      : `Try: launchctl bootstrap gui/${uid} ${LAUNCH_AGENT_PATH}`,
  });

  // 5) launchctl getenv.
  const envRes = tryExec('/bin/launchctl', ['getenv', OTEL_HEADERS_ENV]);
  const envVal = envRes.stdout.trim();
  const envOk = envRes.ok && envVal.startsWith('Authorization=Bearer ');
  results.push({
    name: `${OTEL_HEADERS_ENV} set in launchd`,
    ok: envOk,
    detail: envOk ? 'present (masked)' : envVal || '(empty)',
    hint: envOk ? undefined : 'Log out and back in, or re-run `copilot-otel init`.',
  });

  // 6) Backend validate-token.
  if (cfg && envOk) {
    const tokenMatch = envVal.match(/^Authorization=Bearer\s+(.+)$/);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) {
      results.push({
        name: 'backend /api/cli/validate-token',
        ok: false,
        detail: 'could not parse token from env var',
      });
    } else {
      try {
        const v = await validateToken({ backend: cfg.backendUrl, token });
        results.push({
          name: 'backend /api/cli/validate-token',
          ok: true,
          detail: `user: ${v.username}`,
        });
      } catch (err: unknown) {
        const msg =
          err instanceof BackendError ? `${err.code}: ${err.message}` : (err as Error).message;
        results.push({
          name: 'backend /api/cli/validate-token',
          ok: false,
          detail: msg,
          hint: 'Token may be revoked. Generate a new one in the dashboard.',
        });
      }
    }
  }

  // Print results.
  console.log(kleur.bold('copilot-otel doctor'));
  console.log('');
  let anyFailed = false;
  for (const r of results) {
    const tag = r.ok ? kleur.green('PASS') : kleur.red('FAIL');
    const detail = r.detail ? kleur.dim(` — ${r.detail}`) : '';
    console.log(`  [${tag}] ${r.name}${detail}`);
    if (!r.ok) {
      anyFailed = true;
      if (r.hint) {
        console.log(`         ${kleur.yellow('hint:')} ${r.hint}`);
      }
    }
  }
  console.log('');
  if (anyFailed) {
    console.log(kleur.red('Some checks failed.'));
    process.exit(1);
  }
  console.log(kleur.green('All checks passed.'));
}
