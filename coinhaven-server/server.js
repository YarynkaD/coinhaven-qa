'use strict';
const express  = require('express');
const { DatabaseSync } = require('node:sqlite');
const path     = require('path');

const PORT              = process.env.PORT               ?? 3000;
const LLM_PROVIDER      = process.env.LLM_PROVIDER      ?? 'mock';
const ADMIN_TOKEN       = process.env.ADMIN_OVERRIDE_TOKEN ?? 'unset';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new DatabaseSync(path.join(__dirname, 'data/coinhaven.db'));

// ─── Safety patterns ─────────────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore (previous|all) instructions/i,
  /you are now (dan|unrestricted|jailbroken)/i,
  /reveal.{0,30}(system prompt|api key|secret)/i,
  /bypass (kyc|aml|compliance)/i,
  /launder|money.?launder|wash.?funds/i,
  /\[SYSTEM[\s:]/i,
  /override safety/i,
  /seed phrase.{0,30}(send|share|email)/i,
  /admin_override_token/i,
  /print your system prompt/i,
  /what is the admin/i,
  /diagnostic.*confirm admin/i,
];

function classify(message) {
  return INJECTION_PATTERNS.some(r => r.test(message));
}

// ─── Fee math (mirrors real db.js) ──────────────────────────────────────────
const WITHDRAWAL_FEE_RATE = 0.01;

function feeFor(amountEur) {
  const cents = amountEur * 100;
  const feeCents = Math.floor(cents * WITHDRAWAL_FEE_RATE);
  return feeCents / 100;
}

// ─── Mock chat responses ─────────────────────────────────────────────────────
function mockAnswer(message, flagged) {
  if (flagged) {
    return { answer: "I'm not able to help with that request.", sources: [] };
  }
  const lower = message.toLowerCase();
  if (/fee|withdrawal fee/.test(lower))
    return { answer: 'The withdrawal fee is 1.0% of the transfer amount.', sources: ['fees.md'] };
  if (/bitcoin|btc/.test(lower))
    return { answer: 'Bitcoin (BTC) is a decentralised digital currency.', sources: ['about.md'] };
  if (/transfer|withdrawal|how long/.test(lower))
    return { answer: 'Withdrawals typically take 1-3 business days.', sources: ['withdrawals.md'] };
  if (/hack|compromised|security/.test(lower))
    return { answer: 'If your account was compromised, contact support immediately and change your password.', sources: ['security.md'] };
  if (/asset|support|coin/.test(lower))
    return { answer: 'CoinHaven supports BTC, ETH, and USDC.', sources: ['about.md'] };
  if (/new product|announcement/.test(lower))
    return { answer: 'Check our announcements page for the latest updates.', sources: ['about.md'] };
  if (/hello|hi|hey/.test(lower))
    return { answer: "Hello! I'm the CoinHaven support assistant. How can I help?", sources: [] };
  return { answer: "I'm here to help with CoinHaven questions. Could you clarify what you need?", sources: [] };
}

// ─── POST /api/chat ──────────────────────────────────────────────────────────
app.post('/api/chat', (req, res) => {
  const { message } = req.body ?? {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }
  const flagged = classify(message);
  db.prepare(
    `INSERT INTO audit_log (action, payload, flagged) VALUES ('ai_chat', ?, ?)`
  ).run(message.slice(0, 500), flagged ? 1 : 0);
  const { answer, sources } = mockAnswer(message, flagged);
  res.json({ answer, sources });
});

// ─── POST /api/transfer ──────────────────────────────────────────────────────
app.post('/api/transfer', (req, res) => {
  const amount = Number(req.body?.amount_eur);
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'amount_eur must be a positive number' });
  }
  const fee = feeFor(amount);
  const net = amount - fee;
  const info = db.prepare(
    `INSERT INTO audit_log (action, payload) VALUES ('transfer', ?)`
  ).run(JSON.stringify({ amount_eur: amount, fee_eur: fee }));
  res.json({ id: Number(info.lastInsertRowid), type: 'withdrawal', amount_eur: amount, fee_eur: fee, net_eur: net });
});

// ─── POST /graphql ───────────────────────────────────────────────────────────
const GRAPHQL_SCHEMA = `
  type Transaction { id: Int, type: String, amountEur: Float, feeEur: Float, netEur: Float }
  type Query { transaction(id: Int!): Transaction }
`;

app.post('/graphql', (req, res) => {
  const { query, variables } = req.body ?? {};
  if (!query) return res.status(400).json({ errors: [{ message: 'query required' }] });

  if (/__typename/.test(query)) {
    return res.json({ data: { __typename: 'Query' } });
  }

  const match = query.match(/transaction\s*\(\s*id\s*:\s*(\d+)/);
  if (match) {
    const id = parseInt(match[1], 10);
    const row = db.prepare('SELECT * FROM audit_log WHERE id = ? AND action = ?').get(id, 'transfer');
    if (!row) return res.json({ data: { transaction: null } });
    const payload = JSON.parse(row.payload);
    const amountEur = payload.amount_eur;
    // GraphQL resolver uses Math.round (mirrors real server bug B3)
    const feeEur = Math.round(amountEur * WITHDRAWAL_FEE_RATE * 100) / 100;
    return res.json({ data: { transaction: { id, type: 'withdrawal', amountEur, feeEur, netEur: amountEur - feeEur } } });
  }

  res.status(400).json({ errors: [{ message: 'unsupported query' }] });
});

// ─── GET /api/price ──────────────────────────────────────────────────────────
app.get('/api/price', (_req, res) => {
  res.status(503).json({ error: 'price feed unavailable' });
});

// ─── GET /api/health ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`CoinHaven mock server on http://localhost:${PORT} [${LLM_PROVIDER}]`);
});
