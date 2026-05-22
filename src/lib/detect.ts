import fs from 'node:fs/promises';
import {
  VSCODE_APP_INSIDERS,
  VSCODE_APP_STABLE,
  VSCODE_SETTINGS_INSIDERS,
  VSCODE_SETTINGS_STABLE,
} from './paths.js';

export type VSCodeFlavor = 'stable' | 'insiders';

export interface VSCodeSettingsLocation {
  flavor: VSCodeFlavor;
  settingsPath: string;
  exists: boolean;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function findVSCodeSettings(opts: {
  includeInsiders?: boolean;
} = {}): Promise<VSCodeSettingsLocation[]> {
  const results: VSCodeSettingsLocation[] = [];

  results.push({
    flavor: 'stable',
    settingsPath: VSCODE_SETTINGS_STABLE,
    exists: await pathExists(VSCODE_SETTINGS_STABLE),
  });

  if (opts.includeInsiders) {
    results.push({
      flavor: 'insiders',
      settingsPath: VSCODE_SETTINGS_INSIDERS,
      exists: await pathExists(VSCODE_SETTINGS_INSIDERS),
    });
  }

  return results;
}

export interface VSCodeAppLocation {
  flavor: VSCodeFlavor;
  appPath: string;
  exists: boolean;
}

export async function findVSCodeApp(): Promise<VSCodeAppLocation[]> {
  return [
    {
      flavor: 'stable',
      appPath: VSCODE_APP_STABLE,
      exists: await pathExists(VSCODE_APP_STABLE),
    },
    {
      flavor: 'insiders',
      appPath: VSCODE_APP_INSIDERS,
      exists: await pathExists(VSCODE_APP_INSIDERS),
    },
  ];
}
