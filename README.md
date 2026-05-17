# 🛡️ Project Sentinel — Autonomous Incident Resolution Engine

> **"Manual coding is a failure. Lead the AI."**

A full-stack, AI-powered DevOps dashboard that detects service failures and autonomously resolves them using a **3-agent Ollama system** — no human intervention required.

---

## 🎥 Demo

> Run the Chaos Monkey → watch Sentinel Prime, Subagent Alpha, and Subagent Beta resolve the incident autonomously → service returns to HEALTHY with a regression test written — zero keyboard touches.

---

## Architecture

```
sentinel/
├── app/                        # Next.js 14 dashboard (Port 3000)
│   ├── app/
│   │   ├── page.tsx            # Main dark-mode dashboard UI
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── health/         # Service status polling (every 5s)
│   │       ├── incidents/      # Incident CRUD
│   │       ├── resolve/        # ⚡ Autonomous resolution via Ollama
│   │       └── logs/           # Agent activity logs
│   └── lib/
│       ├── db.ts               # SQLite queries (MCP-style)
│       └── ollama.ts           # Ollama API client
├── services/                   # Mock production microservices
│   ├── auth-service/           # Port 3001 — JWT auth
│   ├── payment-service/        # Port 3002 — Transactions
│   ├── notification-service/   # Port 3003 — Alerts
│   ├── user-service/           # Port 3004 — User profiles
│   └── api-gateway/            # Port 3005 — Health aggregation
├── scripts/
│   ├── chaos-monkey.js         # 🐒 Injects 5 types of bugs randomly
│   ├── sentinel-agent.js       # 🤖 Terminal autonomous resolver (3-agent)
│   ├── poll-health.js          # Pipe to Ollama for live analysis
│   ├── heal-all.js             # Reset all services to clean state
│   └── init-db.js              # SQLite database initializer
├── docs/
│   ├── incident-history.log    # Agent reads this before every fix
│   └── agent-session.log       # Full resolution session export (submission)
├── tests/                      # Regression tests written by Subagent Beta
│   ├── auth-service/
│   ├── payment-service/
│   ├── notification-service/
│   └── user-service/
├── mcp.json                    # SQLite MCP server config for Claude Code
├── CLAUDE.md                   # Agent instruction manual + Resolution Protocol
└── .github/workflows/
    └── sentinel-ci.yml         # GitHub Actions → Vercel deploy
```

---

## The 3-Agent System

| Agent | Role | What It Does |
|---|---|---|
| **Sentinel Prime** | Orchestrator | Finds open incidents, coordinates subagents, updates dashboard state |
| **Subagent Alpha** | Debugger | Reads logs + broken code, sends to Ollama for root cause analysis, applies fix |
| **Subagent Beta** | QA Engineer | Writes a Jest regression test for every fix, saves to `/tests/<service>/` |

Each agent has its own system prompt defining its identity, constraints, and output format — exactly as described in `CLAUDE.md`.

---

## MCP Integration

`mcp.json` at the repo root configures the **SQLite MCP server**:

```json
{
  "mcpServers": {
    "sentinel-db": {
      "command": "npx",
      "args": ["-y", "mcp-server-sqlite", "sentinel.db"]
    }
  }
}
```

When Claude Code is opened inside this folder, it automatically loads `sentinel-db` as a native tool — allowing Claude to run SQL queries directly against the service health database without going through the Node API. The `sentinel-agent.js` script replicates this same agentic loop using Ollama locally.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Ollama** — [ollama.com](https://ollama.com)
- **Model pulled:** `qwen2.5-coder:7b` or `qwen2.5-coder:14b`

```bash
# Verify your models
ollama list

# Should show:
# qwen2.5-coder:14b
# qwen2.5-coder:7b
```

---

## Setup

### 1 — Clone and install

```bash
git clone https://github.com/Harika3009/project-sentinel.git
cd project-sentinel/sentinel
npm run install:all
```

### 2 — Configure environment

```bash
# Create app/.env.local
echo "OLLAMA_MODEL=qwen2.5-coder:7b" > app/.env.local
echo "OLLAMA_HOST=http://localhost:11434" >> app/.env.local
echo "DB_PATH=../sentinel.db" >> app/.env.local

# Set model for terminal scripts
export OLLAMA_MODEL=qwen2.5-coder:7b
```

### 3 — Initialize the database

```bash
npm run db:init
# Creates sentinel.db with 5 services seeded as HEALTHY
```

### 4 — Start the dashboard

```bash
cd app && npm run dev
# → http://localhost:3000
```

All 5 services should appear as HEALTHY (green).

---

## Running the Demo

### Step 1 — Break something

```bash
node scripts/chaos-monkey.js
```

Randomly picks a service and injects one of 5 bug types:

| Bug Type | What Gets Broken |
|---|---|
| `SYNTAX_ERROR` | Invalid token inserted into `src/index.ts` |
| `TYPE_MISMATCH` | Port number changed to a string |
| `LOGIC_ERROR` | `status === 'active'` flipped to `'inactive'` in `helpers.ts` |
| `MISSING_DEPENDENCY` | Package deleted from `package.json`, bad import added |
| `CORRUPT_CONFIG` | `config.json` partially overwritten with garbage |

Refresh `http://localhost:3000` — the service flips to **CRITICAL** (red).

### Step 2 — Let the agents fix it

**Option A — Terminal (recommended for Loom video):**
```bash
node scripts/sentinel-agent.js
```

**Option B — Dashboard:**
Click **⚡ AUTO-RESOLVE ALL** on the dashboard.

**Option C — Target a specific service:**
```bash
node scripts/sentinel-agent.js --service=auth-service
```

Watch the Agent Activity Log fill up:
```
[SentinelPrime]   INCIDENT_RECEIVED   #7 payment-service
[SentinelPrime]   STATUS_UPDATE       payment-service → INVESTIGATING
[SubagentAlpha]   ANALYZING           Service: payment-service, Error: CORRUPT_CONFIG
[SubagentAlpha]   CALLING_OLLAMA      Model: qwen2.5-coder:7b
[SubagentAlpha]   FIX_APPLIED         config.json restored from backup
[SubagentBeta]    TEST_WRITTEN        tests/payment-service/regression-7.test.ts
[SentinelPrime]   INCIDENT_RESOLVED   #7 resolved
```

Service returns to **HEALTHY** (green). ✅

### Step 3 — Pipe commands

```bash
# Analyze health report via Ollama (equivalent to cat log | claude -p)
node scripts/poll-health.js | ollama run qwen2.5-coder:7b "You are Sentinel Prime. Analyze this health report and identify all critical services."

# Analyze a specific service log
cat services/payment-service/logs/app.log | ollama run qwen2.5-coder:7b "Classify this error type and suggest a fix strategy."
```

### Step 4 — Post-mortem

```bash
cat docs/agent-session.log | ollama run qwen2.5-coder:7b "Generate a formal DevOps post-mortem. Include: Executive Summary, Incidents Resolved, Root Causes, Preventive Measures."
```

### Reset for another demo run

```bash
node scripts/heal-all.js
npm run db:init
```

---

## Running Tests

```bash
# All services
npm run test:services

# Single service
cd services/auth-service && npm test
```

Regression tests in `/tests/` are written automatically by Subagent Beta during resolution — one per incident.

---

## CLAUDE.md — Resolution Protocol

Before applying any fix, agents follow this 7-step protocol:

1. **Read** `docs/incident-history.log` — has this fix been attempted before?
2. **If previously failed** → activate Thinking Mode, propose alternative
3. **Isolate** — confirm error is reproducible from logs
4. **Fix** — minimal change only, no unrelated refactoring
5. **Test** — run `npm test` for affected service
6. **Log** — append to `docs/incident-history.log`
7. **Commit** — format: `fix(sentinel): <service> — <description>`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Dashboard | Next.js 14 (App Router) + TypeScript |
| AI Engine | Ollama — `qwen2.5-coder:7b` / `qwen2.5-coder:14b` |
| Database | SQLite via `better-sqlite3` (MCP-configured) |
| Microservices | Express.js + TypeScript |
| Tests | Jest + ts-jest |
| CI/CD | GitHub Actions → Vercel |
| Design | Space Mono + Syne, dark terminal aesthetic |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `sentinel.db not found` | Run `npm run db:init` from root |
| Dashboard shows "No services found" | Run `npm run db:init` |
| Ollama shows UNAVAILABLE in dashboard | Run `ollama serve` in a separate terminal |
| Service stuck on CRITICAL after demo | Run `node scripts/heal-all.js` then `npm run db:init` |
| Port 3000 already in use | `cd app && npm run dev -- -p 3001` |
| `Cannot find module 'better-sqlite3'` | `cd app && npm install` |
| Tests fail with "no test files" | Normal until agent runs — tests written per incident |
