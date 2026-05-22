import kleur from 'kleur';
import ora from 'ora';
import prompts from 'prompts';
import { writeConfig, type Config } from '../lib/config.js';
import { findVSCodeSettings } from '../lib/detect.js';
import * as launchAgent from '../lib/launch-agent.js';
import { applySettings } from '../lib/vscode-settings.js';
import { BackendError, validateToken } from '../lib/backend-client.js';
import { VSCODE_KEYS } from '../lib/paths.js';

export interface InitOptions {
  backend?: string;
  token?: string;
  endpoint?: string;
  captureContent?: boolean;
  force?: boolean;
  insiders?: boolean;
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function deriveEndpoint(backend: string): string {
  // OTel SDK appends /v1/traces, /v1/metrics, /v1/logs to the base endpoint.
  return backend.replace(/\/+$/, '');
}

function deriveDashboardUrl(backend: string): string {
  // backend like https://example.com  -> https://example.com/
  return backend.replace(/\/+$/, '') + '/';
}

export async function runInit(opts: InitOptions): Promise<void> {
  console.log(kleur.bold().cyan('copilot-otel init'));

  // 1) Collect backend + token (prompt if missing).
  const responses = await prompts(
    [
      {
        type: opts.backend ? null : 'text',
        name: 'backend',
        message: 'Backend URL (e.g. https://copilot-otel.example.com)',
        validate: (v: string) =>
          isValidHttpUrl(v) ? true : 'Must be a valid http(s) URL',
      },
      {
        type: opts.token ? null : 'password',
        name: 'token',
        message: 'Ingest token',
        validate: (v: string) => (v && v.trim().length > 0 ? true : 'Token cannot be empty'),
      },
    ],
    {
      onCancel: () => {
        console.error(kleur.red('Aborted.'));
        process.exit(130);
      },
    },
  );

  const backend = (opts.backend ?? responses.backend).replace(/\/+$/, '');
  const token = opts.token ?? responses.token;

  if (!isValidHttpUrl(backend)) {
    console.error(kleur.red(`Invalid backend URL: ${backend}`));
    process.exit(1);
  }
  if (!token) {
    console.error(kleur.red('Token is required.'));
    process.exit(1);
  }

  const endpoint = opts.endpoint ?? deriveEndpoint(backend);
  const captureContent = opts.captureContent !== false; // default true

  // 2) Validate token against backend.
  const validateSpinner = ora('Validating token with backend...').start();
  let validation;
  try {
    validation = await validateToken({ backend, token });
    validateSpinner.succeed(`Token valid (user: ${kleur.bold(validation.username)})`);
  } catch (err: unknown) {
    validateSpinner.fail('Token validation failed.');
    if (err instanceof BackendError) {
      if (err.code === 'unauthorized') {
        console.error(
          kleur.red('  401 Unauthorized: the token was rejected by the backend.'),
        );
        console.error(kleur.dim('  Double-check the value, or generate a new one in the dashboard.'));
      } else {
        console.error(kleur.red(`  ${err.code}: ${err.message}`));
      }
    } else {
      console.error(kleur.red(`  ${(err as Error).message}`));
    }
    process.exit(1);
  }

  // 3) Detect VS Code settings.
  const detectSpinner = ora('Detecting VS Code installation...').start();
  const locations = await findVSCodeSettings({ includeInsiders: !!opts.insiders });
  const targets = locations; // We patch even non-existent ones (will create on demand)
  detectSpinner.succeed(
    `Detected ${targets.length} VS Code target(s): ${targets
      .map((t) => `${t.flavor}${t.exists ? '' : ' (will create)'}`)
      .join(', ')}`,
  );

  // 4) Patch settings.
  const patchSpinner = ora('Patching VS Code settings.json...').start();
  const patchedPaths: string[] = [];
  try {
    for (const target of targets) {
      await applySettings(
        target.settingsPath,
        {
          [VSCODE_KEYS.enabled]: true,
          [VSCODE_KEYS.exporterType]: 'otlp-http',
          [VSCODE_KEYS.otlpEndpoint]: endpoint,
          [VSCODE_KEYS.captureContent]: captureContent,
        },
        { backup: true },
      );
      patchedPaths.push(target.settingsPath);
    }
    patchSpinner.succeed(`Patched ${patchedPaths.length} settings file(s).`);
  } catch (err: unknown) {
    patchSpinner.fail('Failed to patch settings.');
    console.error(kleur.red((err as Error).message));
    process.exit(1);
  }

  // 5) Install LaunchAgent.
  const laSpinner = ora('Installing LaunchAgent (com.copilototel.env)...').start();
  try {
    await launchAgent.install(token);
    laSpinner.succeed('LaunchAgent installed and bootstrapped.');
  } catch (err: unknown) {
    laSpinner.fail('LaunchAgent installation failed.');
    console.error(kleur.red((err as Error).message));
    process.exit(1);
  }

  // 6) Save config.
  const cfgSpinner = ora('Saving config...').start();
  const cfg: Config = {
    backendUrl: backend,
    dashboardUrl: deriveDashboardUrl(backend),
    username: validation.username,
    userId: validation.userId,
    configuredAt: new Date().toISOString(),
    vscodePaths: patchedPaths,
  };
  try {
    await writeConfig(cfg);
    cfgSpinner.succeed('Config saved to ~/.copilot-otel/config.json');
  } catch (err: unknown) {
    cfgSpinner.fail('Failed to save config.');
    console.error(kleur.red((err as Error).message));
    process.exit(1);
  }

  // 7) Summary.
  console.log('');
  console.log(kleur.green().bold('Done!'));
  console.log(`  ${kleur.dim('Backend:')}  ${backend}`);
  console.log(`  ${kleur.dim('Endpoint:')} ${endpoint}`);
  console.log(`  ${kleur.dim('User:')}     ${validation.username}`);
  console.log('');
  console.log(kleur.yellow('Restart VS Code for the new environment variable to take effect.'));
}
