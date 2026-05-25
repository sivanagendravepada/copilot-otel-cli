# Install — copilot-otel-cli

Configures VS Code Copilot Chat to ship OpenTelemetry traces to the Copilot Insights backend.

## Requirements

- macOS
- Node.js >= 20
- VS Code (stable; Insiders optional via `--insiders`)

## Install

No global install needed — run directly from GitHub with `npx`:

```bash
npx -y github:sivanagendravepada/copilot-otel-cli init \
  --backend https://copilot-otel.lovable.app/api/public \
  --token <YOUR_INGEST_TOKEN> \
  --force
```

Replace `<YOUR_INGEST_TOKEN>` with the token issued from the dashboard.

What it does:

1. Validates the token against `https://copilot-otel.lovable.app/api/public/cli/validate-token`.
2. Patches `~/Library/Application Support/Code/User/settings.json` with:
   - `github.copilot.chat.otel.enabled: true`
   - `github.copilot.chat.otel.exporterType: "otlp-http"`
   - `github.copilot.chat.otel.otlpEndpoint: "https://copilot-otel.lovable.app/api/public"`
   - `github.copilot.chat.otel.captureContent: true`
3. Installs LaunchAgent `~/Library/LaunchAgents/com.copilototel.env.plist` (sets `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>`).
4. Saves config to `~/.copilot-otel/config.json`.

**Restart VS Code** so the new `OTEL_EXPORTER_OTLP_HEADERS` env var is picked up.

### Optional flags

| Flag | Effect |
|---|---|
| `--insiders` | Also patch VS Code Insiders settings |
| `--no-capture-content` | Strip prompt/response content from spans |
| `--endpoint <url>` | Override OTLP endpoint (defaults to `--backend`) |

## Verify

Run the doctor command:

```bash
npx -y github:sivanagendravepada/copilot-otel-cli doctor
```

Expected output — all six checks PASS:

```
copilot-otel doctor
  [PASS] config file exists & parses — https://copilot-otel.lovable.app/api/public
  [PASS] VS Code settings keys present (...settings.json)
  [PASS] LaunchAgent plist at ~/Library/LaunchAgents/com.copilototel.env.plist
  [PASS] LaunchAgent loaded (launchctl print)
  [PASS] OTEL_EXPORTER_OTLP_HEADERS set in launchd — present (masked)
  [PASS] backend /cli/validate-token — user: <your-username>
All checks passed.
```

### Manual spot checks

```bash
# Config
cat ~/.copilot-otel/config.json

# VS Code keys
grep "copilot.chat.otel" "$HOME/Library/Application Support/Code/User/settings.json"

# LaunchAgent registered
launchctl list | grep com.copilototel.env

# Env var visible to launchd
launchctl getenv OTEL_EXPORTER_OTLP_HEADERS

# Token validates against backend
curl -sS -X POST \
  -H "Authorization: Bearer <YOUR_INGEST_TOKEN>" \
  https://copilot-otel.lovable.app/api/public/cli/validate-token
# → {"ok":true,"username":"...","userId":"..."}
```

### End-to-end check

1. Restart VS Code.
2. Open Copilot Chat, send a prompt.
3. Open the dashboard:

```bash
npx -y github:sivanagendravepada/copilot-otel-cli dashboard
```

Trace should appear within a few seconds.

## Uninstall

```bash
npx -y github:sivanagendravepada/copilot-otel-cli uninstall
```

Removes LaunchAgent, reverts VS Code settings from backup, deletes `~/.copilot-otel/`. Restart VS Code afterward.
