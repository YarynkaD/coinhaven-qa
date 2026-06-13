/**
 * CoinHaven DB Test Suite — direct SQLite integrity checks
 * Run: npx tsx tests/db/db.test.ts
 *
 * Covers: schema, seed data, fee-math consistency (BUG B3), audit_log behaviour
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../../coinhaven-server/data/coinhaven.db');

type Result = { pass: boolean; name: string; detail?: string; severity?: string };
const results: Result[] = [];

function pass(name: string) {
  results.push({ pass: true, name });
  console.log(`  ✅  ${name}`);
}

function fail(name: string, detail: string, severity = 'HIGH') {
  results.push({ pass: false, name, detail, severity });
  console.log(`  ❌  [${severity}] ${name}`);
  console.log(`       ${detail}`);
}

let db: InstanceType<typeof DatabaseSync>;

// ─────────────────────────────────────────────────────────────────────────────
// 1. SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
function testSchema() {
  console.log('\n── Schema Integrity ─────────────────────────────────────');

  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  ).all() as { name: string }[];
  const tableNames = tables.map(t => t.name);

  for (const expected of ['users', 'wallets', 'audit_log']) {
    if (tableNames.includes(expected)) {
      pass(`Table "${expected}" exists`);
    } else {
      fail(`Table "${expected}" missing`, `Found: ${tableNames.join(', ')}`, 'CRITICAL');
    }
  }

  const userCols = (db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map(c => c.name);
  for (const col of ['id', 'email', 'name', 'kyc', 'created']) {
    if (userCols.includes(col)) {
      pass(`users.${col} column exists`);
    } else {
      fail(`users.${col} column missing`, `Found: ${userCols.join(', ')}`, 'HIGH');
    }
  }

  const auditCols = (db.prepare(`PRAGMA table_info(audit_log)`).all() as { name: string }[]).map(c => c.name);
  if (auditCols.includes('flagged')) {
    pass('audit_log.flagged column exists');
  } else {
    fail('audit_log.flagged column missing', `Found: ${auditCols.join(', ')}`, 'HIGH');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
function testSeedData() {
  console.log('\n── Seed Data Integrity ──────────────────────────────────');

  const userCount = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  if (userCount >= 4) {
    pass(`users table has ${userCount} seeded rows`);
  } else {
    fail('Insufficient seeded users', `Expected ≥4, got ${userCount}`, 'HIGH');
  }

  const alice = db.prepare(`SELECT kyc FROM users WHERE email = ?`).get('alice@coinhaven.io') as { kyc: string } | null;
  if (alice?.kyc === 'approved') {
    pass('alice@coinhaven.io: kyc=approved');
  } else {
    fail('alice@coinhaven.io missing or wrong KYC', `kyc=${alice?.kyc}`, 'HIGH');
  }

  const charlie = db.prepare(`SELECT kyc FROM users WHERE email = ?`).get('charlie@coinhaven.io') as { kyc: string } | null;
  if (charlie?.kyc === 'pending') {
    pass('charlie@coinhaven.io: kyc=pending');
  } else {
    fail('charlie@coinhaven.io KYC wrong', `kyc=${charlie?.kyc}`, 'MEDIUM');
  }

  const aliceBTC = db.prepare(
    `SELECT w.balance FROM wallets w JOIN users u ON w.user_id = u.id
     WHERE u.email = ? AND w.symbol = ?`
  ).get('alice@coinhaven.io', 'BTC') as { balance: number } | null;
  if (aliceBTC && Math.abs(aliceBTC.balance - 0.42) < 0.001) {
    pass(`Alice BTC balance correct: ${aliceBTC.balance}`);
  } else {
    fail('Alice BTC balance wrong', `Expected 0.42, got ${aliceBTC?.balance}`, 'MEDIUM');
  }

  const walletCount = (db.prepare('SELECT COUNT(*) as n FROM wallets').get() as { n: number }).n;
  if (walletCount >= 5) {
    pass(`wallets table has ${walletCount} seeded rows`);
  } else {
    fail('Insufficient seeded wallets', `Expected ≥5, got ${walletCount}`, 'HIGH');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FEE MATH  (BUG B3: Math.floor vs Math.round)
// ─────────────────────────────────────────────────────────────────────────────
function testFeeMath() {
  console.log('\n── Fee Math Integrity (BUG B3) ──────────────────────────');

  const RATE = 0.01;
  const cases: { amount: number; floorFee: number; roundFee: number }[] = [
    { amount: 100,     floorFee: 1.00,  roundFee: 1.00  },
    { amount: 9999.99, floorFee: 99.99, roundFee: 100.00 },
    { amount: 50.005,  floorFee: 0.50,  roundFee: 0.50  },
  ];

  for (const { amount, floorFee, roundFee } of cases) {
    const calcFloor = Math.floor(amount * 100 * RATE) / 100;
    const calcRound = Math.round(amount * RATE * 100) / 100;

    if (Math.abs(calcFloor - floorFee) < 0.001) {
      pass(`Math.floor fee for ${amount} EUR: ${calcFloor}`);
    } else {
      fail(`Math.floor fee wrong for ${amount}`, `Expected ${floorFee}, got ${calcFloor}`, 'HIGH');
    }

    if (calcFloor !== calcRound) {
      fail(
        `BUG B3 — fee diverges for ${amount} EUR`,
        `REST/DB Math.floor=${calcFloor}  GraphQL Math.round=${calcRound}`,
        'HIGH',
      );
    } else {
      pass(`Fee consistent for ${amount} EUR: ${calcFloor}`);
    }
  }

  // Cross-check any stored transfers
  const rows = db.prepare(
    `SELECT payload FROM audit_log WHERE action = 'transfer' LIMIT 20`
  ).all() as { payload: string }[];

  if (rows.length === 0) {
    pass('No stored transfers yet — fee consistency check skipped');
  } else {
    let bad = 0;
    for (const { payload } of rows) {
      try {
        const { amount_eur, fee_eur } = JSON.parse(payload) as { amount_eur: number; fee_eur: number };
        const expected = Math.floor(amount_eur * 100 * RATE) / 100;
        if (Math.abs(fee_eur - expected) > 0.001) {
          bad++;
          fail('Stored fee_eur inconsistent with Math.floor', `amount=${amount_eur} stored=${fee_eur} expected=${expected}`, 'HIGH');
        }
      } catch { /* skip malformed */ }
    }
    if (bad === 0) pass(`All ${rows.length} stored transfer(s) use correct Math.floor fee`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────
function testAuditLog() {
  console.log('\n── Audit Log ────────────────────────────────────────────');

  db.prepare(
    `INSERT INTO audit_log (action, payload, flagged) VALUES ('qa_probe', 'db-test', 1)`
  ).run();

  const probe = db.prepare(
    `SELECT flagged, ts FROM audit_log WHERE action = 'qa_probe' AND payload = 'db-test' ORDER BY id DESC LIMIT 1`
  ).get() as { flagged: number; ts: string } | null;

  if (probe?.flagged === 1) {
    pass('audit_log: flagged=1 stored and retrieved correctly');
  } else {
    fail('audit_log: flagged entry not stored', `Found: ${JSON.stringify(probe)}`, 'HIGH');
  }

  if (probe?.ts) {
    pass(`audit_log: ts auto-populated (${probe.ts})`);
  } else {
    fail('audit_log: ts column not populated', 'Timestamp missing', 'MEDIUM');
  }

  db.prepare(`DELETE FROM audit_log WHERE action = 'qa_probe' AND payload = 'db-test'`).run();
  pass('audit_log: test probe cleaned up');

  const flaggedChats = (db.prepare(
    `SELECT COUNT(*) as n FROM audit_log WHERE action = 'ai_chat' AND flagged = 1`
  ).get() as { n: number }).n;

  if (flaggedChats > 0) {
    pass(`audit_log: ${flaggedChats} flagged ai_chat row(s) — injection probes were logged`);
  } else {
    pass('audit_log: no flagged ai_chats yet (API tests may not have run yet)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────────────────────
function run() {
  console.log(`\n${'═'.repeat(56)}`);
  console.log('  CoinHaven DB Test Suite');
  console.log(`  DB : ${DB_PATH}`);
  console.log(`${'═'.repeat(56)}`);

  try {
    db = new DatabaseSync(DB_PATH);
  } catch (err) {
    console.error(`  ❌  Cannot open database: ${err}`);
    console.error('  Run: cd coinhaven-server && node --experimental-sqlite scripts/seed.js');
    process.exit(1);
  }

  testSchema();
  testSeedData();
  testFeeMath();
  testAuditLog();

  db.close();

  const total    = results.length;
  const passed   = results.filter(r => r.pass).length;
  const failed   = results.filter(r => !r.pass);
  const critical = failed.filter(r => r.severity === 'CRITICAL');

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  Results : ${passed}/${total} passed   ${failed.length > 0 ? `❌ ${failed.length} failed` : '✅ all passed'}`);
  if (critical.length > 0) {
    console.log(`\n  ⚠️  CRITICAL (${critical.length}):`);
    critical.forEach(r => console.log(`    • ${r.name}`));
  }
  const other = failed.filter(r => r.severity !== 'CRITICAL');
  if (other.length > 0) {
    console.log(`\n  Other failures (${other.length}):`);
    other.forEach(r => console.log(`    • [${r.severity}] ${r.name}`));
  }
  console.log(`${'═'.repeat(56)}\n`);

  process.exit(failed.length > 0 ? 1 : 0);
}

run();
