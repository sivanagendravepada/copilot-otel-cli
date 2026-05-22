import fs from 'node:fs/promises';
import path from 'node:path';
import { applyEdits, modify, type ModificationOptions } from 'jsonc-parser';
import { BACKUP_SUFFIX } from './paths.js';

const FORMATTING_OPTIONS: ModificationOptions['formattingOptions'] = {
  tabSize: 2,
  insertSpaces: true,
  eol: '\n',
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readOrEmpty(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'ENOENT'
    ) {
      return '{}\n';
    }
    throw err;
  }
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}`);
  await fs.writeFile(tmp, contents, 'utf8');
  await fs.rename(tmp, filePath);
}

export interface ApplySettingsOptions {
  /** When true, write a backup of the original file (if it exists) once. */
  backup?: boolean;
}

export async function applySettings(
  filePath: string,
  kvPairs: Record<string, unknown>,
  options: ApplySettingsOptions = {},
): Promise<void> {
  const original = await readOrEmpty(filePath);

  if (options.backup) {
    const backupPath = filePath + BACKUP_SUFFIX;
    const backupExists = await pathExists(backupPath);
    const originalExists = await pathExists(filePath);
    if (!backupExists && originalExists) {
      await fs.copyFile(filePath, backupPath);
    }
  }

  let text = original;
  for (const [key, value] of Object.entries(kvPairs)) {
    const edits = modify(text, [key], value, {
      formattingOptions: FORMATTING_OPTIONS,
    });
    text = applyEdits(text, edits);
  }

  await atomicWrite(filePath, text);
}

export async function unsetSettings(
  filePath: string,
  keys: string[],
): Promise<void> {
  if (!(await pathExists(filePath))) return;

  let text = await fs.readFile(filePath, 'utf8');
  for (const key of keys) {
    const edits = modify(text, [key], undefined, {
      formattingOptions: FORMATTING_OPTIONS,
    });
    text = applyEdits(text, edits);
  }
  await atomicWrite(filePath, text);
}

export async function restoreFromBackup(filePath: string): Promise<boolean> {
  const backupPath = filePath + BACKUP_SUFFIX;
  if (!(await pathExists(backupPath))) {
    return false;
  }
  await fs.copyFile(backupPath, filePath);
  await fs.rm(backupPath, { force: true });
  return true;
}
