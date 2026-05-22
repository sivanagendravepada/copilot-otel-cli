import kleur from 'kleur';
import open from 'open';
import { readConfig } from '../lib/config.js';

export interface DashboardOptions {
  print?: boolean;
  url?: string;
}

function deriveDashboardFromBackend(backend: string): string {
  return backend.replace(/\/+$/, '') + '/';
}

export async function runDashboard(opts: DashboardOptions): Promise<void> {
  let url = opts.url;

  if (!url) {
    const cfg = await readConfig();
    if (!cfg) {
      console.error(
        kleur.red('No config found. Run `copilot-otel init` first or pass --url.'),
      );
      process.exit(1);
    }
    url = cfg.dashboardUrl ?? deriveDashboardFromBackend(cfg.backendUrl);
  }

  if (opts.print) {
    console.log(url);
    return;
  }

  console.log(kleur.dim(`Opening ${url} ...`));
  await open(url);
}
