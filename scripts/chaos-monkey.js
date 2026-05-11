#!/usr/bin/env node
// scripts/chaos-monkey.js
// The Chaos Monkey: Randomly introduces bugs into services to test Sentinel

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'sentinel.db');
const SERVICES_DIR = path.join(__dirname, '..', 'services');

const SERVICES = ['auth-service', 'payment-service', 'notification-service', 'user-service'];

// ─── Bug Type Definitions ───────────────────────────────────────────────────

const BUG_TYPES = {
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  LOGIC_ERROR: 'LOGIC_ERROR',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  CORRUPT_CONFIG: 'CORRUPT_CONFIG',
};

// ─── Bug Injectors ──────────────────────────────────────────────────────────

function injectSyntaxError(serviceDir) {
  const indexPath = path.join(serviceDir, 'src', 'index.ts');
  if (!fs.existsSync(indexPath)) return null;

  let content = fs.readFileSync(indexPath, 'utf8');
  // Save original
  fs.writeFileSync(indexPath + '.bak', content);

  // Inject a syntax error: break a function call
  const broken = content.replace(
    /export function (\w+)/,
    'export function $1 CHAOS_SYNTAX_BREAK'
  );

  if (broken === content) {
    // Fallback: add invalid token at line 5
    const lines = content.split('\n');
    lines.splice(5, 0, '<<<CHAOS_SYNTAX_ERROR>>>');
    fs.writeFileSync(indexPath, lines.join('\n'));
  } else {
    fs.writeFileSync(indexPath, broken);
  }

  return `Injected syntax error into ${path.basename(serviceDir)}/src/index.ts`;
}

function injectTypeMismatch(serviceDir) {
  const indexPath = path.join(serviceDir, 'src', 'index.ts');
  if (!fs.existsSync(indexPath)) return null;

  let content = fs.readFileSync(indexPath, 'utf8');
  fs.writeFileSync(indexPath + '.bak', content);

  // Replace a number with a string or vice versa
  const broken = content.replace(
    /port:\s*(\d+)/,
    'port: "CHAOS_TYPE_MISMATCH_STRING"'
  );

  fs.writeFileSync(indexPath, broken);
  return `Injected type mismatch (port as string) into ${path.basename(serviceDir)}/src/index.ts`;
}

function injectLogicError(serviceDir) {
  const helpersPath = path.join(serviceDir, 'src', 'helpers.ts');
  if (!fs.existsSync(helpersPath)) return null;

  let content = fs.readFileSync(helpersPath, 'utf8');
  fs.writeFileSync(helpersPath + '.bak', content);

  // Invert a comparison operator
  const broken = content
    .replace(/status === 'active'/g, "status === 'inactive' /* CHAOS_LOGIC_ERROR */")
    .replace(/count > 0/g, 'count < 0 /* CHAOS_LOGIC_ERROR */');

  fs.writeFileSync(helpersPath, broken);
  return `Injected logic error into ${path.basename(serviceDir)}/src/helpers.ts`;
}

function injectMissingDependency(serviceDir) {
  const pkgPath = path.join(serviceDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  fs.writeFileSync(pkgPath + '.bak', JSON.stringify(pkg, null, 2));

  // Remove a key dependency
  const deps = Object.keys(pkg.dependencies || {});
  if (deps.length === 0) return null;

  const targetDep = deps.find(d => !d.includes('typescript')) || deps[0];
  delete pkg.dependencies[targetDep];

  // Also add a bad import to trigger the error at runtime
  const indexPath = path.join(serviceDir, 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    fs.writeFileSync(indexPath + '.bak', content);
    content = `import { nonExistentModule } from '${targetDep}-chaos-missing'; // CHAOS_MISSING_DEP\n` + content;
    fs.writeFileSync(indexPath, content);
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  return `Removed dependency '${targetDep}' from ${path.basename(serviceDir)}/package.json`;
}

function injectCorruptConfig(serviceDir) {
  const configPath = path.join(serviceDir, 'config.json');
  if (!fs.existsSync(configPath)) return null;

  const original = fs.readFileSync(configPath, 'utf8');
  fs.writeFileSync(configPath + '.bak', original);

  // Corrupt the JSON
  const corrupted = original.slice(0, Math.floor(original.length / 2)) + 
    ' CHAOS_CORRUPT_JSON @@@ ' + 
    original.slice(Math.floor(original.length / 2));

  fs.writeFileSync(configPath, corrupted);
  return `Corrupted config.json in ${path.basename(serviceDir)}`;
}

// ─── Main Chaos Logic ───────────────────────────────────────────────────────

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function runChaos() {
  const db = new Database(DB_PATH);

  // Pick a random service and bug type
  const targetService = pickRandom(SERVICES);
  const bugType = pickRandom(Object.values(BUG_TYPES));
  const serviceDir = path.join(SERVICES_DIR, targetService);

  console.log(`\n🐒 CHAOS MONKEY ACTIVATED`);
  console.log(`🎯 Target Service: ${targetService}`);
  console.log(`🐛 Bug Type: ${bugType}`);
  console.log(`─────────────────────────────`);

  // Make log dir
  const logDir = path.join(serviceDir, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  let description = null;

  try {
    switch (bugType) {
      case BUG_TYPES.SYNTAX_ERROR:
        description = injectSyntaxError(serviceDir);
        break;
      case BUG_TYPES.TYPE_MISMATCH:
        description = injectTypeMismatch(serviceDir);
        break;
      case BUG_TYPES.LOGIC_ERROR:
        description = injectLogicError(serviceDir);
        break;
      case BUG_TYPES.MISSING_DEPENDENCY:
        description = injectMissingDependency(serviceDir);
        break;
      case BUG_TYPES.CORRUPT_CONFIG:
        description = injectCorruptConfig(serviceDir);
        break;
    }

    if (!description) {
      description = `Simulated ${bugType} in ${targetService}`;
    }

    // Write to service error log
    const errorLog = path.join(logDir, 'app.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR [${bugType}] ${description}\n`;
    fs.appendFileSync(errorLog, logEntry);

    // Update DB: mark service as CRITICAL
    db.prepare(`
      UPDATE services SET status = 'CRITICAL', last_error = ?, error_count = error_count + 1, last_checked = CURRENT_TIMESTAMP
      WHERE name = ?
    `).run(`${bugType}: ${description}`, targetService);

    // Create incident
    const result = db.prepare(`
      INSERT INTO incidents (service_name, error_type, error_message, status)
      VALUES (?, ?, ?, 'OPEN')
    `).run(targetService, bugType, description);

    // Log chaos event
    db.prepare(`
      INSERT INTO chaos_events (service_name, bug_type, description, file_affected)
      VALUES (?, ?, ?, ?)
    `).run(targetService, bugType, description, 'src/index.ts');

    console.log(`✅ Bug injected successfully!`);
    console.log(`📝 Description: ${description}`);
    console.log(`🗄️  Incident ID: ${result.lastInsertRowid}`);
    console.log(`\n🛡️  Sentinel should now detect this and begin autonomous resolution.`);
    console.log(`\nCheck the dashboard at http://localhost:3000`);
    console.log(`Or tail the log: tail -f ${errorLog}`);

  } catch (err) {
    console.error('Chaos injection failed:', err.message);
  } finally {
    db.close();
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

runChaos();
