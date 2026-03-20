#!/usr/bin/env bash
set -eo pipefail

# ──────────────────────────────────────────────
# Cencori Agent Installer
# Installs OpenClaw and connects it to Cencori
# ──────────────────────────────────────────────

VERSION="1.0.0"

# Support --dev flag or CENCORI_BASE env var for local testing
if [[ -z "${CENCORI_BASE:-}" ]]; then
    CENCORI_BASE="https://cencori.com"
    for arg in "$@"; do
        case "$arg" in
            --dev) CENCORI_BASE="http://localhost:3000" ;;
        esac
    done
fi
CENCORI_API="${CENCORI_BASE}/api/agent/setup"

# ── Phase 1: Minimal bash bootstrap (no dependencies) ──

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

print_logo() {
    echo ""
    echo -e "${BOLD}  ██████╗███████╗███╗   ██╗ ██████╗ ██████╗ ██████╗ ██╗${NC}"
    echo -e "${BOLD} ██╔════╝██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗██║${NC}"
    echo -e "${BOLD} ██║     █████╗  ██╔██╗ ██║██║     ██║   ██║██████╔╝██║${NC}"
    echo -e "${BOLD} ██║     ██╔══╝  ██║╚██╗██║██║     ██║   ██║██╔══██╗██║${NC}"
    echo -e "${BOLD} ╚██████╗███████╗██║ ╚████║╚██████╗╚██████╔╝██║  ██║██║${NC}"
    echo -e "${BOLD}  ╚═════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝${NC}"
    echo ""
    echo -e "${DIM}  Agent Installer v${VERSION}${NC}"
    echo ""
}

print_logo

# Check for Node.js (required for OpenClaw and our TUI)
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Node.js is required. Install it from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
    echo -e "${RED}✗${NC} Node.js 18+ required (found v${NODE_VERSION})"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Check for curl
if ! command -v curl &> /dev/null; then
    echo -e "${RED}✗${NC} curl is required."
    exit 1
fi

# Detect platform
OS="$(uname -s)"
case "$OS" in
    Linux*)  PLATFORM="linux" ;;
    Darwin*) PLATFORM="macos" ;;
    *)       echo -e "${RED}✗${NC} Unsupported OS: $OS"; exit 1 ;;
esac
echo -e "${GREEN}✓${NC} Platform: ${PLATFORM}"

# ── Phase 2: Set up temp dir with @clack/prompts ──

TMPDIR_INSTALL=$(mktemp -d)
trap 'rm -rf "$TMPDIR_INSTALL"' EXIT

# Create minimal package.json and install @clack/prompts
cat > "$TMPDIR_INSTALL/package.json" << 'EOF'
{ "name": "cencori-installer", "type": "module", "private": true }
EOF

echo -e "${DIM}  Setting up installer...${NC}"
(cd "$TMPDIR_INSTALL" && npm install --silent --no-audit --no-fund @clack/prompts 2>/dev/null) || {
    echo -e "${RED}✗${NC} Failed to set up installer dependencies."
    exit 1
}

# ── Phase 3: Write the Node.js interactive installer ──

cat > "$TMPDIR_INSTALL/installer.mjs" << 'INSTALLER_EOF'
import * as p from '@clack/prompts';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import crypto from 'crypto';

const CENCORI_BASE = process.env.CENCORI_BASE || 'https://cencori.com';
const CENCORI_API = `${CENCORI_BASE}/api/agent/setup`;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    p.intro('Connect to Cencori');

    // ── Step 1: Authenticate ──

    const authMethod = await p.select({
        message: 'How would you like to connect?',
        options: [
            { value: 'paste', label: 'Paste an existing API key', hint: 'from your dashboard' },
            { value: 'browser', label: 'Log in with your browser', hint: 'opens cencori.com' },
        ],
    });

    if (p.isCancel(authMethod)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
    }

    let apiKey, agentId, agentName, agentModel, projectName, dashboardUrl;

    if (authMethod === 'paste') {
        const key = await p.password({
            message: 'Paste your API key:',
            validate: (v) => {
                if (!v || v.length < 10) return 'Please paste a valid API key';
            },
        });

        if (p.isCancel(key)) {
            p.cancel('Setup cancelled.');
            process.exit(0);
        }

        const s = p.spinner();
        s.start('Validating...');

        let data;
        try {
            const res = await fetch(`${CENCORI_API}/validate`, {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                s.stop('Invalid API key');
                p.log.error('Check your key and try again.');
                process.exit(1);
            }

            data = await res.json();
        } catch (err) {
            s.stop('Connection failed');
            p.log.error(`Could not reach Cencori: ${err.message}`);
            process.exit(1);
        }

        projectName = data.project_name || '';
        dashboardUrl = data.dashboard_url || '';

        // Agent key (cake_) — already tied to a specific agent, we're done
        if (data.agent_id) {
            agentId = data.agent_id;
            agentName = data.agent_name;
            agentModel = data.agent_model || 'gpt-4o-mini';
            apiKey = key;
            s.stop(`${agentName} — ${data.org_name} / ${projectName}`);

        // Project key (csk_) — need to select/create agent, then get agent key
        } else {
            const agents = data.agents || [];
            s.stop(`Project: ${data.org_name} / ${projectName}`);

            const agentOptions = [
                ...agents.map(a => ({
                    value: a.id,
                    label: a.name,
                    hint: a.blueprint || undefined,
                })),
                { value: '__new__', label: '+ Create new agent' },
            ];

            const selectedAgent = await p.select({
                message: 'Select an agent',
                options: agentOptions,
            });

            if (p.isCancel(selectedAgent)) {
                p.cancel('Setup cancelled.');
                process.exit(0);
            }

            if (selectedAgent === '__new__') {
                const newName = await p.text({
                    message: 'Agent name:',
                    placeholder: 'My OpenClaw Agent',
                    defaultValue: 'My OpenClaw Agent',
                    validate: (v) => {
                        if (!v || v.trim().length < 2) return 'Name must be at least 2 characters';
                    },
                });

                if (p.isCancel(newName)) {
                    p.cancel('Setup cancelled.');
                    process.exit(0);
                }

                const cs = p.spinner();
                cs.start('Creating agent...');

                try {
                    const res = await fetch(`${CENCORI_API}/validate`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${key}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            agent_name: newName,
                            project_id: data.project_id,
                        }),
                    });

                    if (!res.ok) {
                        cs.stop('Failed to create agent');
                        p.log.error('Could not create agent. Try from the dashboard.');
                        process.exit(1);
                    }

                    const agent = await res.json();
                    agentId = agent.id;
                    agentName = agent.name;
                    agentModel = agent.model || 'gpt-4o-mini';
                    cs.stop(`Created: ${agentName}`);
                } catch (err) {
                    cs.stop('Failed');
                    p.log.error(err.message);
                    process.exit(1);
                }
            } else {
                const chosen = agents.find(a => a.id === selectedAgent);
                agentId = selectedAgent;
                agentName = chosen?.name || 'Agent';
                agentModel = chosen?.model || 'gpt-4o-mini';
            }

            // Project key flow: user needs to get the agent's cake_ key
            const agentUrl = dashboardUrl ? `${dashboardUrl}/agents/${agentId}` : 'your Cencori dashboard';

            p.note(
                [
                    `Go to your agent's Configuration tab and click "Generate Key".`,
                    '',
                    `  ${agentUrl}`,
                    '',
                    `Copy the cake_ key and paste it below.`,
                ].join('\n'),
                `Generate key for "${agentName}"`
            );

            const agentKey = await p.password({
                message: 'Paste agent key (cake_...):',
                validate: (v) => {
                    if (!v || v.length < 10) return 'Please paste the agent key';
                },
            });

            if (p.isCancel(agentKey)) {
                p.cancel('Setup cancelled.');
                process.exit(0);
            }

            apiKey = agentKey;
        }

        p.log.success(`Agent "${agentName}" connected`);

    } else {
        // Browser auth flow
        const token = crypto.randomUUID();
        const authUrl = `${CENCORI_BASE}/dashboard/agent-setup?token=${token}`;

        // Open browser
        let browserOpened = false;
        try {
            const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
            execSync(`${cmd} "${authUrl}"`, { stdio: 'ignore' });
            browserOpened = true;
        } catch { /* ignore */ }

        if (!browserOpened) {
            p.log.info(`Open this URL in your browser:\n  ${authUrl}`);
        }

        p.note(
            'Create or select an agent, then click "Connect".',
            'Complete setup in your browser'
        );

        const s = p.spinner();
        s.start('Waiting for browser...');

        const maxWait = 120;
        let waited = 0;

        while (waited < maxWait) {
            try {
                const res = await fetch(`${CENCORI_API}/poll?token=${token}`);
                const data = await res.json();

                if (data.status === 'ready' && data.api_key) {
                    apiKey = data.api_key;
                    agentId = data.agent_id || '';
                    agentName = data.agent_name || 'Agent';
                    projectName = data.project_name || '';
                    s.stop(`Connected — ${agentName} (${projectName})`);
                    break;
                }
            } catch { /* ignore */ }

            await sleep(2000);
            waited += 2;
            s.message(`Waiting for browser... (${waited}s)`);
        }

        if (!apiKey) {
            s.stop('Timed out');
            p.log.error('Browser authentication timed out. Try again or paste your API key.');
            process.exit(1);
        }
    }

    // ── Step 2: Check / Install OpenClaw ──

    let openclawInstalled = false;

    try {
        const version = execSync('openclaw --version 2>/dev/null', { encoding: 'utf8' }).trim();
        p.log.success(`OpenClaw already installed (${version})`);
        openclawInstalled = true;
    } catch {
        const s = p.spinner();
        s.start('Installing OpenClaw...');

        // Try the official install script with non-interactive flags
        try {
            const tmpScript = '/tmp/openclaw_install_cencori.sh';
            execSync(`curl -fsSL https://openclaw.ai/install.sh -o ${tmpScript}`, { stdio: 'ignore' });
            execSync(
                `NO_PROMPT=1 NO_ONBOARD=1 OPENCLAW_NO_PROMPT=1 OPENCLAW_NO_ONBOARD=1 bash ${tmpScript} --no-prompt --no-onboard`,
                { stdio: 'pipe', timeout: 120000 }
            );
            execSync(`rm -f ${tmpScript}`, { stdio: 'ignore' });
            s.stop('OpenClaw installed');
            openclawInstalled = true;
        } catch {
            // Fallback: try npm
            try {
                execSync('npm install -g openclaw', { stdio: 'pipe', timeout: 60000 });
                s.stop('OpenClaw installed via npm');
                openclawInstalled = true;
            } catch {
                s.stop('Could not auto-install OpenClaw');
                p.log.warn('Install OpenClaw manually, then re-run this script:');
                p.note('curl -sSL https://openclaw.ai/install.sh | bash', 'Install OpenClaw');
            }
        }
    }

    // ── Step 3: Configure ──

    const s2 = p.spinner();
    s2.start('Configuring OpenClaw to use Cencori...');

    const home = homedir();
    const shellName = path.basename(process.env.SHELL || 'bash');
    let rcFile;
    switch (shellName) {
        case 'zsh':  rcFile = path.join(home, '.zshrc'); break;
        case 'fish': rcFile = path.join(home, '.config/fish/config.fish'); break;
        default:     rcFile = path.join(home, '.bashrc'); break;
    }

    // Write full OpenClaw config with Cencori as provider + model pre-configured
    const openclawDir = path.join(home, '.openclaw');
    mkdirSync(openclawDir, { recursive: true });

    // Use "auto" so the gateway resolves model from agent config on the dashboard.
    // Changing the model on the dashboard takes effect immediately — no local config update needed.
    const displayModel = agentModel || 'auto';
    const openclawConfig = {
        models: {
            mode: 'merge',
            providers: {
                cencori: {
                    baseUrl: 'https://api.cencori.com/v1',
                    apiKey: apiKey,
                    api: 'openai-completions',
                    models: [
                        { id: 'auto', name: 'Auto (from dashboard)' },
                    ],
                },
            },
        },
        agents: {
            defaults: {
                model: {
                    primary: 'cencori/auto',
                },
            },
        },
    };

    // Merge with existing config if present, otherwise write fresh
    const configPath = path.join(openclawDir, 'openclaw.json');
    let existingConfig = {};
    try { existingConfig = JSON.parse(readFileSync(configPath, 'utf8')); } catch { /* fresh install */ }

    // Deep merge: preserve existing settings, override provider + model
    const merged = {
        ...existingConfig,
        models: {
            ...(existingConfig.models || {}),
            mode: 'merge',
            providers: {
                ...(existingConfig.models?.providers || {}),
                cencori: openclawConfig.models.providers.cencori,
            },
        },
        agents: {
            ...(existingConfig.agents || {}),
            defaults: {
                ...(existingConfig.agents?.defaults || {}),
                model: openclawConfig.agents.defaults.model,
            },
        },
        gateway: {
            ...(existingConfig.gateway || {}),
            mode: existingConfig.gateway?.mode || 'local',
        },
    };

    writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n');

    // Add env vars to shell config
    const marker = '# Cencori Agent Configuration';
    let rcContent = '';
    try { rcContent = readFileSync(rcFile, 'utf8'); } catch { /* file may not exist */ }

    if (!rcContent.includes(marker)) {
        const envBlock = [
            '',
            marker,
            'export OPENAI_BASE_URL=https://api.cencori.com/v1',
            `export OPENAI_API_KEY=${apiKey}`,
            ...(agentId ? [`export CENCORI_AGENT_ID=${agentId}`] : []),
            '',
        ].join('\n');
        appendFileSync(rcFile, envBlock);
    } else {
        // Update existing key
        const updated = rcContent.replace(
            /export OPENAI_API_KEY=.*/,
            `export OPENAI_API_KEY=${apiKey}`
        );
        writeFileSync(rcFile, updated);
    }

    s2.stop('Configuration saved');

    // ── Step 4: Summary & Launch ──

    p.note(
        [
            `Agent:     ${agentName || 'Your Agent'}`,
            ...(projectName ? [`Project:   ${projectName}`] : []),
            `Model:     ${displayModel === 'auto' ? 'auto (set from dashboard)' : displayModel}`,
            `Gateway:   https://api.cencori.com/v1`,
            `Dashboard: https://cencori.com/dashboard`,
            '',
            `Config:    ~/.openclaw/openclaw.json`,
            `Shell:     ${rcFile}`,
        ].join('\n'),
        'Setup complete!'
    );

    if (openclawInstalled) {
        p.outro('OpenClaw is ready. Run `openclaw tui` to start chatting.');
    } else {
        p.outro('Install OpenClaw, then run `openclaw tui` to start.');
    }
}

main().catch((err) => {
    p.log.error(err.message);
    process.exit(1);
});
INSTALLER_EOF

# ── Phase 4: Run the Node.js installer ──

exec node "$TMPDIR_INSTALL/installer.mjs" </dev/tty
