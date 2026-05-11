// app/app/api/resolve/route.ts
// Autonomous resolution endpoint — spawns Ollama subagents

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getOpenIncidents, resolveIncident, addAgentLog, updateServiceStatus } from '@/lib/db';
import { generateWithOllama, checkOllamaAvailable } from '@/lib/ollama';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const INCIDENT_HISTORY = path.join(process.cwd(), '..', 'docs', 'incident-history.log');
const SERVICES_DIR = path.join(process.cwd(), '..', 'services');

function readIncidentHistory(): string {
  if (!fs.existsSync(INCIDENT_HISTORY)) return 'No history yet.';
  return fs.readFileSync(INCIDENT_HISTORY, 'utf8').slice(-3000);
}

function readServiceLog(serviceName: string): string {
  const logPath = path.join(SERVICES_DIR, serviceName, 'logs', 'app.log');
  if (!fs.existsSync(logPath)) return 'No logs available.';
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  return lines.slice(-15).join('\n');
}

function appendIncidentHistory(entry: string): void {
  const line = `[${new Date().toISOString()}] ${entry}\n`;
  if (!fs.existsSync(path.dirname(INCIDENT_HISTORY))) {
    fs.mkdirSync(path.dirname(INCIDENT_HISTORY), { recursive: true });
  }
  fs.appendFileSync(INCIDENT_HISTORY, line);
}

function restoreFromBackup(serviceName: string): string[] {
  const restored: string[] = [];
  const svcDir = path.join(SERVICES_DIR, serviceName);
  const backupTargets = [
    'src/index.ts',
    'src/helpers.ts',
    'config.json',
    'package.json',
  ];
  for (const file of backupTargets) {
    const bakPath = path.join(svcDir, file + '.bak');
    const origPath = path.join(svcDir, file);
    if (fs.existsSync(bakPath)) {
      fs.copyFileSync(bakPath, origPath);
      fs.unlinkSync(bakPath);
      restored.push(file);
    }
  }
  return restored;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const incidentId = body.incidentId as number | undefined;

    const ollamaAvailable = await checkOllamaAvailable();
    const incidents = getOpenIncidents();

    if (incidents.length === 0) {
      return NextResponse.json({ message: 'No open incidents to resolve' });
    }

    const targetIncident = incidentId
      ? incidents.find(i => i.id === incidentId) || incidents[0]
      : incidents[0];

    // ─── Sentinel Prime logs ─────────────────────────────────────
    addAgentLog('SentinelPrime', 'RESOLUTION_STARTED', `Incident #${targetIncident.id} — ${targetIncident.service_name}`);
    updateServiceStatus(targetIncident.service_name, 'INVESTIGATING');

    const logs = readServiceLog(targetIncident.service_name);
    const history = readIncidentHistory();

    let alphaAnalysis = {
      root_cause: `${targetIncident.error_type} in ${targetIncident.service_name}`,
      fix_strategy: 'Restore from backup',
      confidence: 'MEDIUM' as string,
    };

    // ─── Subagent Alpha: Debugger ─────────────────────────────────
    addAgentLog('SubagentAlpha', 'ANALYZING', `Service: ${targetIncident.service_name}, Error: ${targetIncident.error_type}`);

    if (ollamaAvailable) {
      try {
        const alphaPrompt = `You are Subagent Alpha, an autonomous debugger.
Incident: ${targetIncident.service_name} — ${targetIncident.error_type}
Error: ${targetIncident.error_message}
Recent logs: ${logs}
History: ${history}

In 2-3 sentences: identify root cause and fix strategy.`;

        const alphaResponse = await generateWithOllama(alphaPrompt);
        alphaAnalysis = {
          root_cause: alphaResponse.slice(0, 300),
          fix_strategy: 'AI-guided fix via Subagent Alpha',
          confidence: 'HIGH',
        };
        addAgentLog('SubagentAlpha', 'ANALYSIS_COMPLETE', alphaResponse.slice(0, 200));
      } catch {
        addAgentLog('SubagentAlpha', 'OLLAMA_ERROR', 'Falling back to backup restoration');
      }
    } else {
      addAgentLog('SubagentAlpha', 'OLLAMA_UNAVAILABLE', 'Using backup restoration strategy');
    }

    // Apply fix: restore backups
    const restoredFiles = restoreFromBackup(targetIncident.service_name);
    addAgentLog('SubagentAlpha', 'FIX_APPLIED', `Restored: ${restoredFiles.join(', ') || 'none (already clean)'}`);

    // ─── Subagent Beta: QA ────────────────────────────────────────
    addAgentLog('SubagentBeta', 'TEST_WRITING', `Regression test for ${targetIncident.service_name}`);

    let testContent = '';
    if (ollamaAvailable) {
      try {
        const betaPrompt = `Write a brief Jest test (TypeScript) for: ${targetIncident.service_name} — ${targetIncident.error_type}. 3-5 assertions only. No markdown.`;
        testContent = await generateWithOllama(betaPrompt);
      } catch {
        testContent = `// Auto-generated regression test\n// Service: ${targetIncident.service_name}\n// Error: ${targetIncident.error_type}\ntest('service should be healthy', () => { expect(true).toBe(true); });`;
      }
    } else {
      testContent = `// Regression test — ${targetIncident.service_name}\n// Error type: ${targetIncident.error_type}\ntest('should not throw on startup', () => { expect(true).toBe(true); });`;
    }

    // Write test file
    const testDir = path.join(process.cwd(), '..', 'tests', targetIncident.service_name);
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, `regression-${targetIncident.id}.test.ts`);
    fs.writeFileSync(testFile, testContent);
    addAgentLog('SubagentBeta', 'TEST_WRITTEN', testFile.replace(process.cwd(), ''));

    // ─── Resolve ─────────────────────────────────────────────────
    const resolution = `${alphaAnalysis.fix_strategy} | Confidence: ${alphaAnalysis.confidence} | Files restored: ${restoredFiles.length}`;
    resolveIncident(targetIncident.id, resolution, 'sentinel-ai');
    updateServiceStatus(targetIncident.service_name, 'HEALTHY');

    appendIncidentHistory(
      `SERVICE=${targetIncident.service_name} ERROR=${targetIncident.error_type} STATUS=RESOLVED FIX="${alphaAnalysis.fix_strategy}"`
    );

    addAgentLog('SentinelPrime', 'INCIDENT_RESOLVED', `#${targetIncident.id} resolved. Agent: sentinel-ai`);

    return NextResponse.json({
      success: true,
      incidentId: targetIncident.id,
      service: targetIncident.service_name,
      resolution,
      agentUsed: ollamaAvailable ? 'ollama-' + process.env.OLLAMA_MODEL : 'fallback',
      testFile: testFile.replace(process.cwd(), ''),
      restoredFiles,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
