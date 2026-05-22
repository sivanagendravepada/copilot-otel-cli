import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { CONFIG_DIR, CONFIG_FILE } from './paths.js';

export const ConfigSchema = z.object({
  backendUrl: z.string().url(),
  dashboardUrl: z.string().url().optional(),
  username: z.string(),
  userId: z.string(),
  configuredAt: z.string(),
  vscodePaths: z.array(z.string()),
});

export type Config = z.infer<typeof ConfigSchema>;

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

export async function readConfig(): Promise<Config | null> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return ConfigSchema.parse(parsed);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }
}

export async function writeConfig(cfg: Config): Promise<void> {
  ConfigSchema.parse(cfg);
  await ensureConfigDir();
  const tmp = path.join(CONFIG_DIR, `config.json.tmp-${process.pid}`);
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  await fs.rename(tmp, CONFIG_FILE);
}

export async function deleteConfig(): Promise<void> {
  try {
    await fs.rm(CONFIG_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
