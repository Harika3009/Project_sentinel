#!/usr/bin/env node
// scripts/heal-all.js
// Restores all services to their pre-chaos state using .bak files

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'sentinel.db');
const SERVICES_DIR = path.join(__dirname, '..', 'services');
const SERVICES = ['auth-service', 'payment-service', 'notification-service', 'user-service', 'api-gateway'];

console.log('🔧 Sentinel Heal-All: Restoring services...\n');

let restored = 0;

for (const service of SERVICES) {
  const serviceDir = path.join(SERVICES_DIR, service);
  const filesToCheck = [
    'src/index.ts',
    'src/helpers.ts',
    'package.json',
    'config.json',
  ];

  for (const file of filesToCheck) {
    const filePath = path.join(serviceDir, file);
    const bakPath = filePath + '.bak';

    if (fs.existsSync(bakPath)) {
      fs.copyFileSync(bakPath, filePath);
      fs.unlinkSync(bakPath);
      console.log(`✅ Restored: ${service}/${file}`);
      restored++;
    }
  }
}

// Reset DB statuses
const db = new Database(DB_PATH);
db.prepare(`UPDATE services SET status = 'HEALTHY', last_error = NULL`).run();
db.prepare(`UPDATE incidents SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, agent = 'heal-all' WHERE status = 'OPEN'`).run();
db.close();

console.log(`\n🛡️  Heal complete. Restored ${restored} file(s).`);
console.log('All services reset to HEALTHY in database.');
