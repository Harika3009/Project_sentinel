#!/usr/bin/env node
// scripts/poll-health.js
// Polls service health and prints status — designed to be piped to claude
// Usage: node scripts/poll-health.js | claude -p "Analyze this and update dashboard"

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'sentinel.db');
const SERVICES_DIR = path.join(__dirname, '..', 'services');

const db = new Database(DB_PATH, { readonly: true });

const services = db.prepare('SELECT * FROM services ORDER BY name').all();
const openIncidents = db.prepare("SELECT * FROM incidents WHERE status = 'OPEN' ORDER BY created_at DESC").all();
const recentResolved = db.prepare("SELECT * FROM incidents WHERE status = 'RESOLVED' ORDER BY resolved_at DESC LIMIT 5").all();

console.log('=== SENTINEL HEALTH REPORT ===');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('');
console.log('--- SERVICE STATUS ---');
for (const svc of services) {
  const icon = svc.status === 'HEALTHY' ? '✅' : svc.status === 'WARNING' ? '⚠️' : '🔴';
  console.log(`${icon} ${svc.name}: ${svc.status} | Port: ${svc.port} | Errors: ${svc.error_count}`);
  if (svc.last_error) {
    console.log(`   Last Error: ${svc.last_error}`);
  }
}

console.log('');
console.log('--- OPEN INCIDENTS ---');
if (openIncidents.length === 0) {
  console.log('No open incidents.');
} else {
  for (const inc of openIncidents) {
    console.log(`[#${inc.id}] ${inc.service_name} | ${inc.error_type} | ${inc.created_at}`);
    console.log(`   Message: ${inc.error_message}`);
  }
}

console.log('');
console.log('--- RECENT RESOLUTIONS ---');
if (recentResolved.length === 0) {
  console.log('No resolved incidents yet.');
} else {
  for (const inc of recentResolved) {
    console.log(`[#${inc.id}] ${inc.service_name} | Resolved at ${inc.resolved_at} by ${inc.agent}`);
    if (inc.resolution) console.log(`   Fix: ${inc.resolution}`);
  }
}

// Also check logs
console.log('');
console.log('--- RECENT LOG ERRORS ---');
const logServices = ['auth-service', 'payment-service', 'notification-service', 'user-service'];
for (const svc of logServices) {
  const logPath = path.join(SERVICES_DIR, svc, 'logs', 'app.log');
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const lastLines = lines.slice(-3);
    const errorLines = lastLines.filter(l => l.includes('ERROR') || l.includes('CRITICAL'));
    if (errorLines.length > 0) {
      console.log(`\n[${svc}]`);
      errorLines.forEach(l => console.log(` ${l}`));
    }
  }
}

db.close();
