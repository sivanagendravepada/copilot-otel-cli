import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  LAUNCH_AGENT_DIR,
  LAUNCH_AGENT_LABEL,
  LAUNCH_AGENT_PATH,
  OTEL_HEADERS_ENV,
} from './paths.js';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generatePlist(token: string): string {
  const headerValue = `Authorization=Bearer ${token}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${escapeXml(LAUNCH_AGENT_LABEL)}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/launchctl</string>
        <string>setenv</string>
        <string>${escapeXml(OTEL_HEADERS_ENV)}</string>
        <string>${escapeXml(headerValue)}</string>
    </array>
</dict>
</plist>
`;
}

function uid(): number {
  if (typeof process.getuid !== 'function') {
    throw new Error('process.getuid() is unavailable; this CLI requires macOS.');
  }
  return process.getuid();
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

export async function install(token: string): Promise<void> {
  if (!token) throw new Error('install() requires a non-empty token.');
  await fs.mkdir(LAUNCH_AGENT_DIR, { recursive: true });

  const plist = generatePlist(token);
  const tmp = path.join(LAUNCH_AGENT_DIR, `.${path.basename(LAUNCH_AGENT_PATH)}.tmp-${process.pid}`);
  await fs.writeFile(tmp, plist, { mode: 0o600 });
  await fs.rename(tmp, LAUNCH_AGENT_PATH);

  const u = uid();
  // Bootout existing (ignore failure)
  tryExec('/bin/launchctl', ['bootout', `gui/${u}/${LAUNCH_AGENT_LABEL}`]);
  // Bootstrap
  const bootstrap = tryExec('/bin/launchctl', ['bootstrap', `gui/${u}`, LAUNCH_AGENT_PATH]);
  if (!bootstrap.ok) {
    throw new Error(
      `Failed to bootstrap LaunchAgent: ${bootstrap.stderr || bootstrap.stdout || 'unknown error'}`,
    );
  }
  // Best-effort: immediately set the env var in current launchd session so we don't
  // require a re-login for verification.
  tryExec('/bin/launchctl', [
    'setenv',
    OTEL_HEADERS_ENV,
    `Authorization=Bearer ${token}`,
  ]);
}

export async function uninstall(): Promise<void> {
  const u = uid();
  tryExec('/bin/launchctl', ['bootout', `gui/${u}/${LAUNCH_AGENT_LABEL}`]);
  tryExec('/bin/launchctl', ['unsetenv', OTEL_HEADERS_ENV]);
  try {
    await fs.rm(LAUNCH_AGENT_PATH, { force: true });
  } catch {
    // ignore
  }
}

export function isLoaded(): boolean {
  const u = uid();
  const res = tryExec('/bin/launchctl', ['print', `gui/${u}/${LAUNCH_AGENT_LABEL}`]);
  return res.ok;
}

export async function getCurrentToken(): Promise<string | null> {
  // Prefer launchctl getenv, fall back to parsing the plist on disk.
  const env = tryExec('/bin/launchctl', ['getenv', OTEL_HEADERS_ENV]);
  if (env.ok) {
    const val = env.stdout.trim();
    const m = val.match(/^Authorization=Bearer\s+(.+)$/);
    if (m) return m[1];
  }

  try {
    const plist = await fs.readFile(LAUNCH_AGENT_PATH, 'utf8');
    const m = plist.match(/Authorization=Bearer\s+([^<]+)<\/string>/);
    if (m) return m[1].trim();
  } catch {
    // ignore
  }
  return null;
}

export function getCurrentHeaderValue(): string | null {
  const env = tryExec('/bin/launchctl', ['getenv', OTEL_HEADERS_ENV]);
  if (env.ok) {
    const val = env.stdout.trim();
    return val || null;
  }
  return null;
}
