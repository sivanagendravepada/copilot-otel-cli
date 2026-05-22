import { Command } from 'commander';
import kleur from 'kleur';
import { runInit } from '../commands/init.js';
import { runDashboard } from '../commands/dashboard.js';
import { runDoctor } from '../commands/doctor.js';
import { runUninstall } from '../commands/uninstall.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('copilot-otel')
  .description('Configure VS Code Copilot Chat OpenTelemetry export.')
  .version(VERSION, '-v, --version', 'show CLI version');

program
  .command('init')
  .description('Patch VS Code settings.json and install macOS LaunchAgent.')
  .option('--backend <url>', 'Backend URL (e.g. https://copilot-otel.example.com)')
  .option('--token <token>', 'Ingest token (will be prompted if omitted)')
  .option('--endpoint <url>', 'Override OTLP endpoint (defaults to <backend>, SDK appends /v1/traces)')
  .option('--no-capture-content', 'Do not include prompt/response content in spans')
  .option('--force', 'Overwrite existing config without prompting')
  .option('--insiders', 'Also patch VS Code Insiders settings.json')
  .action(async (opts) => {
    try {
      await runInit(opts);
    } catch (err) {
      console.error(kleur.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('dashboard')
  .description('Open the Copilot OTel dashboard in the browser.')
  .option('--print', 'Print URL instead of opening it')
  .option('--url <url>', 'Override dashboard URL')
  .action(async (opts) => {
    try {
      await runDashboard(opts);
    } catch (err) {
      console.error(kleur.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Diagnose the current Copilot OTel installation.')
  .action(async () => {
    try {
      await runDoctor();
    } catch (err) {
      console.error(kleur.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Remove the LaunchAgent and revert VS Code settings.')
  .option('--keep-settings', 'Leave VS Code settings.json untouched')
  .action(async (opts) => {
    try {
      await runUninstall(opts);
    } catch (err) {
      console.error(kleur.red((err as Error).message));
      process.exit(1);
    }
  });

await program.parseAsync(process.argv);
