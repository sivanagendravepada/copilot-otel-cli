# copilot-otel-cli

CLI to configure VS Code Copilot Chat OpenTelemetry export. Patches your VS Code `settings.json` and installs a macOS LaunchAgent so Copilot Chat traces flow to your OTLP backend.

> Companion to the [`copilot-otel`](https://github.com/) backend + dashboard stack. This CLI configures the client side; the server lives in its own repo.

## Install

```bash
npm i -g copilot-otel-cli
```

Requires Node.js >= 20. macOS only (LaunchAgent-based).

## Quickstart

```bash
copilot-otel init --backend https://copilot-otel.example.com
```

You will be prompted for an ingest token if `--token` is omitted. The CLI:

1. Patches `settings.json` for VS Code (and optionally Insiders).
2. Writes a LaunchAgent plist under `~/Library/LaunchAgents/`.
3. Loads the agent so the OTLP exporter starts immediately.

## Commands

### `init`

Patch VS Code settings + install LaunchAgent.

| Flag | Description |
|---|---|
| `--backend <url>` | Backend base URL (e.g. `https://copilot-otel.example.com`) |
| `--token <token>` | Ingest token (prompted if omitted) |
| `--endpoint <url>` | Override OTLP endpoint (defaults to `<backend>`; SDK appends `/v1/traces`) |
| `--no-capture-content` | Exclude prompt/response content from spans |
| `--force` | Overwrite existing config without prompting |
| `--insiders` | Also patch VS Code Insiders `settings.json` |

### `dashboard`

Open the dashboard in your browser.

| Flag | Description |
|---|---|
| `--print` | Print URL instead of opening |
| `--url <url>` | Override dashboard URL |

### `doctor`

Diagnose the current installation — checks settings.json, LaunchAgent status, backend connectivity.

### `uninstall`

Remove the LaunchAgent and revert VS Code settings.

| Flag | Description |
|---|---|
| `--keep-settings` | Leave `settings.json` untouched |

## Configuration locations

| Path | Purpose |
|---|---|
| `~/Library/Application Support/Code/User/settings.json` | VS Code Copilot OTel settings |
| `~/Library/Application Support/Code - Insiders/User/settings.json` | VS Code Insiders (with `--insiders`) |
| `~/Library/LaunchAgents/com.copilot-otel.exporter.plist` | LaunchAgent definition |
| `~/.copilot-otel/config.json` | CLI state (backend URL, token reference) |

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
node dist/bin/copilot-otel.js --help
```

## License

MIT
