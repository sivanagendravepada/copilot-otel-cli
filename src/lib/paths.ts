import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();

export const LAUNCH_AGENT_LABEL = 'com.copilototel.env';
export const LAUNCH_AGENT_FILENAME = `${LAUNCH_AGENT_LABEL}.plist`;
export const LAUNCH_AGENT_DIR = path.join(HOME, 'Library', 'LaunchAgents');
export const LAUNCH_AGENT_PATH = path.join(LAUNCH_AGENT_DIR, LAUNCH_AGENT_FILENAME);

export const CONFIG_DIR = path.join(HOME, '.copilot-otel');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const BACKUP_SUFFIX = '.copilot-otel.bak';

export const VSCODE_SETTINGS_STABLE = path.join(
  HOME,
  'Library',
  'Application Support',
  'Code',
  'User',
  'settings.json',
);
export const VSCODE_SETTINGS_INSIDERS = path.join(
  HOME,
  'Library',
  'Application Support',
  'Code - Insiders',
  'User',
  'settings.json',
);

export const VSCODE_APP_STABLE = '/Applications/Visual Studio Code.app';
export const VSCODE_APP_INSIDERS = '/Applications/Visual Studio Code - Insiders.app';

export const OTEL_HEADERS_ENV = 'OTEL_EXPORTER_OTLP_HEADERS';

export const VSCODE_KEYS = {
  enabled: 'github.copilot.chat.otel.enabled',
  exporterType: 'github.copilot.chat.otel.exporterType',
  otlpEndpoint: 'github.copilot.chat.otel.otlpEndpoint',
  captureContent: 'github.copilot.chat.otel.captureContent',
} as const;
