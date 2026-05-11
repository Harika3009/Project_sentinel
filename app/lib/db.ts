// app/lib/db.ts
// SQLite access for the dashboard — MCP-style direct DB queries

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'sentinel.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: false });
  }
  return db;
}

export interface ServiceRecord {
  id: number;
  name: string;
  status: string;
  port: number;
  last_checked: string;
  error_count: number;
  last_error: string | null;
  uptime_seconds: number;
}

export interface IncidentRecord {
  id: number;
  service_name: string;
  error_type: string;
  error_message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  agent: string;
  fix_commit: string | null;
}

export interface AgentLog {
  id: number;
  agent_name: string;
  action: string;
  details: string;
  timestamp: string;
}

export function getServices(): ServiceRecord[] {
  return getDb().prepare('SELECT * FROM services ORDER BY name').all() as ServiceRecord[];
}

export function getOpenIncidents(): IncidentRecord[] {
  return getDb()
    .prepare("SELECT * FROM incidents WHERE status = 'OPEN' ORDER BY created_at DESC")
    .all() as IncidentRecord[];
}

export function getResolvedIncidents(limit: number = 10): IncidentRecord[] {
  return getDb()
    .prepare("SELECT * FROM incidents WHERE status = 'RESOLVED' ORDER BY resolved_at DESC LIMIT ?")
    .all(limit) as IncidentRecord[];
}

export function getAllIncidents(limit: number = 20): IncidentRecord[] {
  return getDb()
    .prepare('SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?')
    .all(limit) as IncidentRecord[];
}

export function getAgentLogs(limit: number = 50): AgentLog[] {
  return getDb()
    .prepare('SELECT * FROM agent_logs ORDER BY timestamp DESC LIMIT ?')
    .all(limit) as AgentLog[];
}

export function updateServiceStatus(name: string, status: string): void {
  getDb()
    .prepare('UPDATE services SET status = ?, last_checked = CURRENT_TIMESTAMP WHERE name = ?')
    .run(status, name);
}

export function resolveIncident(id: number, resolution: string, agent: string): void {
  getDb()
    .prepare(
      "UPDATE incidents SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, resolution = ?, agent = ? WHERE id = ?"
    )
    .run(resolution, agent, id);
}

export function addAgentLog(agentName: string, action: string, details: string): void {
  getDb()
    .prepare('INSERT INTO agent_logs (agent_name, action, details) VALUES (?, ?, ?)')
    .run(agentName, action, details);
}

export function getSystemStats(): {
  totalServices: number;
  healthyServices: number;
  criticalServices: number;
  openIncidents: number;
  resolvedToday: number;
} {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number }).c;
  const healthy = (
    db.prepare("SELECT COUNT(*) as c FROM services WHERE status = 'HEALTHY'").get() as { c: number }
  ).c;
  const critical = (
    db.prepare("SELECT COUNT(*) as c FROM services WHERE status = 'CRITICAL'").get() as { c: number }
  ).c;
  const open = (
    db.prepare("SELECT COUNT(*) as c FROM incidents WHERE status = 'OPEN'").get() as { c: number }
  ).c;
  const resolvedToday = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM incidents WHERE status = 'RESOLVED' AND date(resolved_at) = date('now')"
      )
      .get() as { c: number }
  ).c;

  return {
    totalServices: total,
    healthyServices: healthy,
    criticalServices: critical,
    openIncidents: open,
    resolvedToday,
  };
}
