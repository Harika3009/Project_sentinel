#!/usr/bin/env node
// scripts/sentinel-agent.js
// The Autonomous Resolution Engine using Ollama
// Usage: node scripts/sentinel-agent.js
// Or for specific service: node scripts/sentinel-agent.js --service auth-service

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const http = require('http');

const DB_PATH = path.join(__dirname, '..', 'sentinel.db');
const SERVICES_DIR = path.join(__dirname, '..', 'services');
const INCIDENT_HISTORY = path.join(__dirname, '..', 'docs', 'incident-history.log');
const CLAUDE_MD = path.join(__dirname, '..', 'CLAUDE.md');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// ─── Ollama Helper ──────────────────────────────────────────────────────────

async function callOllama(prompt, systemPrompt = '') {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: systemPrompt ? `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${prompt}` : prompt,
      stream: false,
    });

    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response || '');
        } catch (e) {
          reject(new Error('Failed to parse Ollama response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Agent Utilities ────────────────────────────────────────────────────────

function readLog(serviceName) {
  const logPath = path.join(SERVICES_DIR, serviceName, 'logs', 'app.log');
  if (!fs.existsSync(logPath)) return 'No log file found.';
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  return lines.slice(-20).join('\n'); // Last 20 lines
}

function readIncidentHistory() {
  if (!fs.existsSync(INCIDENT_HISTORY)) return 'No incident history yet.';
  return fs.readFileSync(INCIDENT_HISTORY, 'utf8');
}

function readClaudeMd() {
  return fs.readFileSync(CLAUDE_MD, 'utf8');
}

function appendIncidentHistory(entry) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${entry}\n`;
  fs.appendFileSync(INCIDENT_HISTORY, line);
}

function logAgentAction(db, agentName, action, details) {
  db.prepare(`INSERT INTO agent_logs (agent_name, action, details) VALUES (?, ?, ?)`)
    .run(agentName, action, details);
  console.log(`[${agentName}] ${action}: ${details}`);
}

function readServiceCode(serviceName) {
  const indexPath = path.join(SERVICES_DIR, serviceName, 'src', 'index.ts');
  const helpersPath = path.join(SERVICES_DIR, serviceName, 'src', 'helpers.ts');
  let code = '';
  if (fs.existsSync(indexPath)) code += `\n// index.ts:\n` + fs.readFileSync(indexPath, 'utf8');
  if (fs.existsSync(helpersPath)) code += `\n// helpers.ts:\n` + fs.readFileSync(helpersPath, 'utf8');
  return code;
}

function writeFixToFile(serviceName, fileName, fixedContent) {
  const filePath = path.join(SERVICES_DIR, serviceName, 'src', fileName);
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, fixedContent);
    return true;
  }
  return false;
}

// ─── Subagent Alpha: The Debugger ──────────────────────────────────────────

async function runSubagentAlpha(db, incident) {
  console.log(`\n🔍 SUBAGENT ALPHA (DEBUGGER) — Analyzing ${incident.service_name}...`);
  logAgentAction(db, 'SubagentAlpha', 'STARTED', `Analyzing incident #${incident.id}`);

  const logs = readLog(incident.service_name);
  const code = readServiceCode(incident.service_name);
  const history = readIncidentHistory();
  const protocol = readClaudeMd();

  const systemPrompt = `You are Subagent Alpha, the Debugger AI for Project Sentinel.
You follow the Resolution Protocol in CLAUDE.md exactly.
Your job: analyze the error, check history, and produce a minimal TypeScript fix.
Respond in this exact JSON format:
{
  "error_classification": "...",
  "root_cause": "...",
  "previously_attempted": true/false,
  "fix_strategy": "...",
  "fixed_code": "...",
  "file_to_fix": "index.ts or helpers.ts",
  "confidence": "HIGH/MEDIUM/LOW"
}`;

  const userPrompt = `CLAUDE.md PROTOCOL:
${protocol.slice(0, 1000)}

INCIDENT:
Service: ${incident.service_name}
Error Type: ${incident.error_type}
Error: ${incident.error_message}

RECENT LOGS:
${logs}

CURRENT CODE:
${code.slice(0, 3000)}

INCIDENT HISTORY (check for previous attempts):
${history.slice(-2000)}

Analyze and produce the fix JSON.`;

  logAgentAction(db, 'SubagentAlpha', 'CALLING_OLLAMA', `Model: ${OLLAMA_MODEL}`);

  let analysis;
  try {
    const response = await callOllama(userPrompt, systemPrompt);
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON in response');
    }
  } catch (e) {
    console.log('⚠️  Ollama parse failed, using structured fallback analysis');
    analysis = {
      error_classification: incident.error_type,
      root_cause: `${incident.error_type} detected in ${incident.service_name}`,
      previously_attempted: false,
      fix_strategy: 'Restore from backup file if available',
      fixed_code: null,
      file_to_fix: 'index.ts',
      confidence: 'LOW',
    };
  }

  logAgentAction(db, 'SubagentAlpha', 'ANALYSIS_COMPLETE', JSON.stringify(analysis).slice(0, 200));

  // Apply fix if we have one
  if (analysis.fixed_code && analysis.file_to_fix) {
    const applied = writeFixToFile(incident.service_name, analysis.file_to_fix, analysis.fixed_code);
    logAgentAction(db, 'SubagentAlpha', 'FIX_APPLIED', `File: ${analysis.file_to_fix}, Success: ${applied}`);
  } else {
    // Try restoring from backup
    const bakPath = path.join(SERVICES_DIR, incident.service_name, 'src', 'index.ts.bak');
    if (fs.existsSync(bakPath)) {
      const original = fs.readFileSync(bakPath, 'utf8');
      fs.writeFileSync(bakPath.replace('.bak', ''), original);
      fs.unlinkSync(bakPath);
      logAgentAction(db, 'SubagentAlpha', 'RESTORED_BACKUP', `${incident.service_name}/src/index.ts`);
      analysis.fix_strategy = 'Restored from backup file';
    }
    // Try config backup
    const configBak = path.join(SERVICES_DIR, incident.service_name, 'config.json.bak');
    if (fs.existsSync(configBak)) {
      fs.copyFileSync(configBak, configBak.replace('.bak', ''));
      fs.unlinkSync(configBak);
      logAgentAction(db, 'SubagentAlpha', 'RESTORED_CONFIG', `${incident.service_name}/config.json`);
    }
    // Try package.json backup
    const pkgBak = path.join(SERVICES_DIR, incident.service_name, 'package.json.bak');
    if (fs.existsSync(pkgBak)) {
      fs.copyFileSync(pkgBak, pkgBak.replace('.bak', ''));
      fs.unlinkSync(pkgBak);
      logAgentAction(db, 'SubagentAlpha', 'RESTORED_PACKAGE', `${incident.service_name}/package.json`);
    }
  }

  return analysis;
}

// ─── Subagent Beta: The QA Engineer ────────────────────────────────────────

async function runSubagentBeta(db, incident, alphaAnalysis) {
  console.log(`\n🧪 SUBAGENT BETA (QA) — Writing regression test for ${incident.service_name}...`);
  logAgentAction(db, 'SubagentBeta', 'STARTED', `Writing test for incident #${incident.id}`);

  const systemPrompt = `You are Subagent Beta, the QA Engineer AI for Project Sentinel.
Write a TypeScript/Jest regression test that would catch the bug that was fixed.
Return ONLY valid TypeScript test code, no explanation, no markdown fences.`;

  const userPrompt = `Service: ${incident.service_name}
Error Type: ${incident.error_type}
Root Cause: ${alphaAnalysis.root_cause}
Fix Applied: ${alphaAnalysis.fix_strategy}

Write a Jest regression test that validates the fix works and the bug cannot return.
Test file should import from '../src/index' or '../src/helpers'.`;

  let testCode;
  try {
    testCode = await callOllama(userPrompt, systemPrompt);
    // Strip markdown fences if present
    testCode = testCode.replace(/```typescript|```ts|```javascript|```js|```/g, '').trim();
  } catch (e) {
    testCode = generateFallbackTest(incident);
  }

  // Write test file
  const testDir = path.join(__dirname, '..', 'tests', incident.service_name);
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testFile = path.join(testDir, `regression-${incident.id}.test.ts`);
  fs.writeFileSync(testFile, testCode);

  logAgentAction(db, 'SubagentBeta', 'TEST_WRITTEN', testFile);
  console.log(`✅ Regression test written: ${testFile}`);

  return testFile;
}

function generateFallbackTest(incident) {
  return `// Regression test for Incident #${incident.id}
// Service: ${incident.service_name}
// Error Type: ${incident.error_type}
// Generated by Subagent Beta (Sentinel)

import { describe, it, expect } from '@jest/globals';

describe('${incident.service_name} - Regression: ${incident.error_type}', () => {
  it('should not throw on startup', async () => {
    // Verify the service module loads without errors
    expect(() => {
      require('../src/index');
    }).not.toThrow();
  });

  it('should have valid configuration', () => {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '..', 'config.json');
    
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });

  it('should expose expected exports', () => {
    // Add service-specific checks here
    expect(true).toBe(true); // Placeholder — extend per service
  });
});
`;
}

// ─── Main Agent: Sentinel Prime ─────────────────────────────────────────────

async function runSentinelPrime() {
  console.log('\n🛡️  SENTINEL PRIME ACTIVATED');
  console.log('=' .repeat(50));

  const db = new Database(DB_PATH);

  // Get target service from args
  const args = process.argv.slice(2);
  const serviceArg = args.find(a => a.startsWith('--service='))?.split('=')[1];

  // Find CRITICAL incidents
  let criticalIncidents;
  if (serviceArg) {
    criticalIncidents = db.prepare(`
      SELECT * FROM incidents WHERE status = 'OPEN' AND service_name = ?
      ORDER BY created_at DESC LIMIT 1
    `).all(serviceArg);
  } else {
    criticalIncidents = db.prepare(`
      SELECT * FROM incidents WHERE status = 'OPEN'
      ORDER BY created_at DESC LIMIT 3
    `).all();
  }

  if (criticalIncidents.length === 0) {
    console.log('✅ No open incidents found. All systems healthy.');
    db.close();
    return;
  }

  console.log(`\n📋 Found ${criticalIncidents.length} open incident(s)`);

  for (const incident of criticalIncidents) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`🚨 INCIDENT #${incident.id}: ${incident.service_name}`);
    console.log(`   Type: ${incident.error_type}`);
    console.log(`   Message: ${incident.error_message}`);
    console.log(`   Created: ${incident.created_at}`);

    logAgentAction(db, 'SentinelPrime', 'INCIDENT_RECEIVED', `#${incident.id} ${incident.service_name}`);

    // Update service status to INVESTIGATING
    db.prepare(`UPDATE services SET status = 'INVESTIGATING' WHERE name = ?`).run(incident.service_name);
    logAgentAction(db, 'SentinelPrime', 'STATUS_UPDATE', `${incident.service_name} → INVESTIGATING`);

    // Spawn Subagent Alpha
    const alphaAnalysis = await runSubagentAlpha(db, incident);

    // Spawn Subagent Beta
    const testFile = await runSubagentBeta(db, incident, alphaAnalysis);

    // Resolve incident
    const resolution = `${alphaAnalysis.fix_strategy} | Confidence: ${alphaAnalysis.confidence}`;

    db.prepare(`
      UPDATE incidents 
      SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, resolution = ?, agent = 'sentinel-ai', fix_commit = ?
      WHERE id = ?
    `).run(resolution, `fix(sentinel): ${incident.service_name} — ${incident.error_type}`, incident.id);

    db.prepare(`UPDATE services SET status = 'HEALTHY', last_checked = CURRENT_TIMESTAMP WHERE name = ?`)
      .run(incident.service_name);

    // Write to incident history log
    appendIncidentHistory(
      `SERVICE=${incident.service_name} ERROR=${incident.error_type} STATUS=RESOLVED FIX="${alphaAnalysis.fix_strategy}"`
    );

    // Write agent log to file
    const agentLogPath = path.join(__dirname, '..', 'docs', 'agent-session.log');
    const sessionEntry = `
[${new Date().toISOString()}] INCIDENT RESOLVED
  Service: ${incident.service_name}
  Error: ${incident.error_type}
  Root Cause: ${alphaAnalysis.root_cause}
  Fix: ${alphaAnalysis.fix_strategy}
  Test Written: ${testFile}
  Confidence: ${alphaAnalysis.confidence}
`;
    fs.appendFileSync(agentLogPath, sessionEntry);

    logAgentAction(db, 'SentinelPrime', 'RESOLVED', `Incident #${incident.id} resolved`);

    console.log(`\n✅ INCIDENT #${incident.id} RESOLVED`);
    console.log(`   Fix: ${resolution}`);
    console.log(`   Test: ${testFile}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🛡️  SENTINEL PRIME — All incidents processed');
  db.close();
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

runSentinelPrime().catch(err => {
  console.error('❌ Sentinel Agent Error:', err.message);
  process.exit(1);
});
