import kleur from 'kleur';
import ora from 'ora';
import { deleteConfig, readConfig } from '../lib/config.js';
import * as launchAgent from '../lib/launch-agent.js';
import { restoreFromBackup, unsetSettings } from '../lib/vscode-settings.js';
import { VSCODE_KEYS } from '../lib/paths.js';
import { findVSCodeSettings } from '../lib/detect.js';

export interface UninstallOptions {
  keepSettings?: boolean;
}

export async function runUninstall(opts: UninstallOptions): Promise<void> {
  console.log(kleur.bold().cyan('copilot-otel uninstall'));

  // LaunchAgent removal.
  const laSpinner = ora('Removing LaunchAgent...').start();
  try {
    await launchAgent.uninstall();
    laSpinner.succeed('LaunchAgent removed.');
  } catch (err: unknown) {
    laSpinner.warn(`LaunchAgent removal had issues: ${(err as Error).message}`);
  }

  // Settings.
  if (!opts.keepSettings) {
    const cfg = await readConfig().catch(() => null);
    const settingsPaths = cfg?.vscodePaths?.length
      ? cfg.vscodePaths
      : (await findVSCodeSettings({ includeInsiders: true }))
          .filter((l) => l.exists)
          .map((l) => l.settingsPath);

    for (const p of settingsPaths) {
      const sSpinner = ora(`Reverting ${p}...`).start();
      try {
        const restored = await restoreFromBackup(p);
        if (restored) {
          sSpinner.succeed(`Restored ${p} from backup.`);
        } else {
          await unsetSettings(p, Object.values(VSCODE_KEYS));
          sSpinner.succeed(`Unset Copilot OTel keys in ${p}.`);
        }
      } catch (err: unknown) {
        sSpinner.fail(`Could not revert ${p}: ${(err as Error).message}`);
      }
    }
  } else {
    console.log(kleur.dim('--keep-settings: leaving VS Code settings untouched.'));
  }

  // Config dir.
  const cfgSpinner = ora('Removing ~/.copilot-otel/...').start();
  try {
    await deleteConfig();
    cfgSpinner.succeed('Config directory removed.');
  } catch (err: unknown) {
    cfgSpinner.fail(`Could not remove config dir: ${(err as Error).message}`);
  }

  console.log('');
  console.log(kleur.green('Uninstall complete.'));
  console.log(kleur.yellow('Restart VS Code to clear the OTEL_EXPORTER_OTLP_HEADERS env var.'));
}
