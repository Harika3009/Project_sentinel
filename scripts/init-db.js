// scripts/init-db.js
// Initializes the SQLite database for service health tracking

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'sentinel.db');

console.log('🛡️  Initializing Sentinel Database...');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'HEALTHY',
    port INTEGER,
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    uptime_seconds INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    error_type TEXT,
    error_message TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolution TEXT,
    agent TEXT DEFAULT 'human',
    fix_commit TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chaos_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    bug_type TEXT NOT NULL,
    description TEXT,
    file_affected TEXT,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    healed_at DATETIME
  );
`);

// Seed services
const services = [
  { name: 'auth-service', port: 3001 },
  { name: 'payment-service', port: 3002 },
  { name: 'notification-service', port: 3003 },
  { name: 'user-service', port: 3004 },
  { name: 'api-gateway', port: 3005 },
];

const insertService = db.prepare(`
  INSERT OR REPLACE INTO services (name, status, port, error_count)
  VALUES (@name, 'HEALTHY', @port, 0)
`);

for (const service of services) {
  insertService.run(service);
}

console.log('✅ Database initialized with', services.length, 'services');
console.log('📁 Database location:', DB_PATH);

db.close();
