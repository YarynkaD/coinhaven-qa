'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '../data/coinhaven.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    email   TEXT UNIQUE NOT NULL,
    name    TEXT NOT NULL,
    kyc     TEXT DEFAULT 'pending',
    created TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wallets (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    symbol  TEXT NOT NULL,
    balance REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER,
    action    TEXT,
    payload   TEXT,
    flagged   INTEGER DEFAULT 0,
    ts        TEXT DEFAULT (datetime('now'))
  );
`);

const insertUser = db.prepare(
  `INSERT OR IGNORE INTO users (email, name, kyc) VALUES (?, ?, ?)`
);
const insertWallet = db.prepare(
  `INSERT INTO wallets (user_id, symbol, balance)
   SELECT id, ?, ? FROM users WHERE email = ?`
);

const users = [
  ['alice@coinhaven.io',   'Alice Kowalski',  'approved'],
  ['bob@coinhaven.io',     'Bob Marchetti',   'approved'],
  ['charlie@coinhaven.io', 'Charlie Dubois',  'pending'],
  ['test@qa.internal',     'QA Bot',          'approved'],
];

for (const [email, name, kyc] of users) {
  insertUser.run(email, name, kyc);
}

insertWallet.run('BTC',  0.42,   'alice@coinhaven.io');
insertWallet.run('ETH',  5.81,   'alice@coinhaven.io');
insertWallet.run('BTC',  0.01,   'bob@coinhaven.io');
insertWallet.run('USDC', 1200.0, 'bob@coinhaven.io');
insertWallet.run('ETH',  0.5,    'test@qa.internal');

console.log('✅  Database seeded → data/coinhaven.db');
console.log(`   users:   ${db.prepare('SELECT COUNT(*) as n FROM users').get().n}`);
console.log(`   wallets: ${db.prepare('SELECT COUNT(*) as n FROM wallets').get().n}`);

db.close();
