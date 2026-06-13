'use strict';
const express  = require('express');
const Database = require('better-sqlite3');
const path     = require('path');

const PORT         = process.env.PORT         ?? 3000;
const LLM_PROVIDER = process.env.LLM_PROVIDER ?? 'mock';

const app = express();
app.use(express.json());

const db = new Database(path.join(__dirname, 'data/coinhaven.db'));

// ─── Safety patterns ──────────────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore (previous|all) instructions/i,
  /you are now (dan|unrestricted|jailbroken)/i,
  /reveal.{0,30}(system prompt|api key|secret)/i,
  /bypass (kyc|aml|compliance)/i,
  /launder|money.?launder|wash.?funds/i,
  /\[SYSTEM[\s:]/i,
  /override safety/i,
  /seed phrase.{0,30}(send|share|email)/i,
];

const LEAK_PATTERNS = [
  /show.{0,20}(user|account).{0,20}(detail|balance|email)/i,
  /list all (user|customer|email)/i,
  /database schema|table name|column name/i,
  /api key|environment variable|process\.env/i,
  /private key|secret key/i,
];

function classify(message) {
  const flagged = [...INJECTION_PATTERNS, ...LEAK_PATTERNS].some(r => r.test(message));
  return flagged;
}

// ─── Mock LLM responses ───────────────────────────────────────────────────────
function mockResponse(message, flagged) {
  if (flagged) {
    return "I'm not able to help with that request. If you have questions about CoinHaven's features, I'm happy to assist.";
  }

  const lower = message.toLowerCase();

  if (/bitcoin|btc/.test(lower))
    return 'Bitcoin (BTC) is a decentralised digital currency. For real-time prices, please check the Markets section.';
  if (/ethereum|eth/.test(lower))
    return 'Ethereum (ETH) is a programmable blockchain platform. CoinHaven supports ETH trading and staking.';
  if (/password|reset/.test(lower))
    return 'To reset your password, use the "Forgot password" link on the login page. Never share your seed phrase.';
  if (/fee|fees/.test(lower))
    return 'CoinHaven charges 0.1% per trade. Withdrawals are free above €50 equivalent.';
  if (/hello|hi|hey/.test(lower))
    return 'Hello! I\'m the CoinHaven AI assistant. How can I help you today?';
  if (/fakecoin|2099|non.?exist/.test(lower))
    return "I don't have data on that asset. I cannot confirm prices for coins not listed on CoinHaven.";
  if (/sec|regul|ruling/.test(lower))
    return "I'm not aware of any specific regulatory ruling on CoinHaven. For official information, please consult legal counsel.";
  if (/wallet address|cold wallet/.test(lower))
    return 'CoinHaven does not publish internal wallet addresses publicly. Please use the deposit flow in your dashboard.';

  return "I'm here to help with CoinHaven questions. Could you clarify what you need?";
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.post('/api/chat', (req, res) => {
  const { message } = req.body ?? {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  const flagged = classify(message);

  db.prepare(
    `INSERT INTO audit_log (action, payload, flagged) VALUES ('ai_chat', ?, ?)`
  ).run(message.slice(0, 500), flagged ? 1 : 0);

  const response = LLM_PROVIDER === 'mock'
    ? mockResponse(message, flagged)
    : '(real LLM not configured)';

  res.json({ response, flagged });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', provider: LLM_PROVIDER, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀  CoinHaven server running on http://localhost:${PORT}`);
  console.log(`   LLM provider : ${LLM_PROVIDER}`);
  console.log(`   Database     : data/coinhaven.db\n`);
});
