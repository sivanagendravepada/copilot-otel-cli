import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => Buffer.from('')),
}));

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

import { execFileSync } from 'node:child_process';
import { vol } from 'memfs';
import {
  generatePlist,
  install,
  uninstall,
  getCurrentToken,
} from '../lib/launch-agent.js';
import { LAUNCH_AGENT_PATH } from '../lib/paths.js';

beforeEach(() => {
  vol.reset();
  (execFileSync as unknown as { mockClear: () => void }).mockClear();
});

describe('launch-agent', () => {
  it('generatePlist matches expected snapshot', () => {
    const plist = generatePlist('abc123');
    expect(plist).toMatchInlineSnapshot(`
      "<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
          <key>Label</key>
          <string>com.copilototel.env</string>
          <key>RunAtLoad</key>
          <true/>
          <key>ProgramArguments</key>
          <array>
              <string>/bin/launchctl</string>
              <string>setenv</string>
              <string>OTEL_EXPORTER_OTLP_HEADERS</string>
              <string>Authorization=Bearer abc123</string>
          </array>
      </dict>
      </plist>
      "
    `);
  });

  it('generatePlist xml-escapes special characters in token', () => {
    const plist = generatePlist('a<b&c"d');
    expect(plist).toContain('Authorization=Bearer a&lt;b&amp;c&quot;d');
  });

  it('install() writes plist and invokes launchctl bootout + bootstrap', async () => {
    await install('tok-xyz');
    expect(vol.existsSync(LAUNCH_AGENT_PATH)).toBe(true);
    const content = vol.readFileSync(LAUNCH_AGENT_PATH, 'utf8') as string;
    expect(content).toContain('Authorization=Bearer tok-xyz');

    const calls = (execFileSync as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    // Expect at least bootout + bootstrap to have been called against launchctl.
    const argsList = calls.map((c) => c[1] as string[]);
    expect(argsList.some((a) => a[0] === 'bootout')).toBe(true);
    expect(argsList.some((a) => a[0] === 'bootstrap')).toBe(true);
  });

  it('uninstall() removes the plist file and calls bootout', async () => {
    await install('tok');
    expect(vol.existsSync(LAUNCH_AGENT_PATH)).toBe(true);
    await uninstall();
    expect(vol.existsSync(LAUNCH_AGENT_PATH)).toBe(false);
  });

  it('getCurrentToken() parses plist when launchctl getenv returns empty', async () => {
    (execFileSync as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      () => Buffer.from(''),
    );
    await install('parsed-token');
    // Force getenv to throw so we fall back to parsing the file.
    (execFileSync as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      (_file: string, args: string[]) => {
        if (args[0] === 'getenv') {
          const err = new Error('not set') as Error & { stderr?: Buffer };
          err.stderr = Buffer.from('');
          throw err;
        }
        return Buffer.from('');
      },
    );
    const tok = await getCurrentToken();
    expect(tok).toBe('parsed-token');
  });
});
