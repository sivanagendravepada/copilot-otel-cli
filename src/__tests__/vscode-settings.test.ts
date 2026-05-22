import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'node:path';

// Mock node:fs/promises with memfs.
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

import {
  applySettings,
  restoreFromBackup,
  unsetSettings,
} from '../lib/vscode-settings.js';
import { BACKUP_SUFFIX } from '../lib/paths.js';

const DIR = '/test/User';
const SETTINGS = path.join(DIR, 'settings.json');

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(DIR, { recursive: true });
});

afterEach(() => {
  vol.reset();
});

describe('vscode-settings', () => {
  it('applySettings adds keys to an empty file', async () => {
    await applySettings(SETTINGS, { 'github.copilot.chat.otel.enabled': true });
    const out = vol.readFileSync(SETTINGS, 'utf8') as string;
    expect(out).toContain('"github.copilot.chat.otel.enabled"');
    expect(out).toContain('true');
  });

  it('applySettings preserves comments and trailing commas', async () => {
    const original = `{
  // user comment
  "editor.fontSize": 14,
}
`;
    vol.writeFileSync(SETTINGS, original);
    await applySettings(SETTINGS, {
      'github.copilot.chat.otel.enabled': true,
    });
    const out = vol.readFileSync(SETTINGS, 'utf8') as string;
    expect(out).toContain('// user comment');
    expect(out).toContain('"editor.fontSize": 14');
    expect(out).toContain('"github.copilot.chat.otel.enabled": true');
  });

  it('applySettings creates a single backup and does not overwrite it', async () => {
    const original = '{\n  "editor.fontSize": 14\n}\n';
    vol.writeFileSync(SETTINGS, original);

    await applySettings(SETTINGS, { 'a.b': 1 }, { backup: true });
    const backupPath = SETTINGS + BACKUP_SUFFIX;
    expect(vol.existsSync(backupPath)).toBe(true);
    expect(vol.readFileSync(backupPath, 'utf8')).toBe(original);

    // Second call should NOT overwrite the backup with the now-modified file.
    await applySettings(SETTINGS, { 'a.c': 2 }, { backup: true });
    expect(vol.readFileSync(backupPath, 'utf8')).toBe(original);
  });

  it('applySettings writes atomically (no .tmp left behind)', async () => {
    await applySettings(SETTINGS, { 'a.b': 1 });
    const entries = vol.readdirSync(DIR) as string[];
    expect(entries.some((e) => e.includes('.tmp-'))).toBe(false);
    expect(entries).toContain('settings.json');
  });

  it('unsetSettings removes keys', async () => {
    vol.writeFileSync(
      SETTINGS,
      JSON.stringify(
        {
          'editor.fontSize': 14,
          'github.copilot.chat.otel.enabled': true,
        },
        null,
        2,
      ),
    );
    await unsetSettings(SETTINGS, ['github.copilot.chat.otel.enabled']);
    const out = vol.readFileSync(SETTINGS, 'utf8') as string;
    expect(out).not.toContain('github.copilot.chat.otel.enabled');
    expect(out).toContain('editor.fontSize');
  });

  it('restoreFromBackup copies backup over and removes it', async () => {
    const original = '{\n  "editor.fontSize": 14\n}\n';
    vol.writeFileSync(SETTINGS, original);
    await applySettings(SETTINGS, { 'a.b': 1 }, { backup: true });

    const ok = await restoreFromBackup(SETTINGS);
    expect(ok).toBe(true);
    expect(vol.readFileSync(SETTINGS, 'utf8')).toBe(original);
    expect(vol.existsSync(SETTINGS + BACKUP_SUFFIX)).toBe(false);
  });

  it('restoreFromBackup returns false if no backup', async () => {
    vol.writeFileSync(SETTINGS, '{}');
    const ok = await restoreFromBackup(SETTINGS);
    expect(ok).toBe(false);
  });
});
