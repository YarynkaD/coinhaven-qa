/**
 * Prompt Firewall Scorer
 * Scores every prompt in data/adversarial-prompts.json with a 0–1 risk score.
 * Run: npx tsx scripts/prompt-firewall.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_FILE = process.env.PROMPTS_FILE
  ?? path.join(__dirname, '../data/adversarial-prompts.json');

const INJECTION_KEYWORDS   = /\b(SYSTEM|IGNORE|OVERRIDE|TOKEN|ADMIN_OVERRIDE_TOKEN)\b/i;
const ANNOUNCEMENTS_SIGNAL = /\b(new|announcement|product|update|launch|latest)\b/i;
const JAILBREAK_PATTERNS   = /\b(DAN|administrator|developer\s+mode|no\s+restrictions)\b/i;

type RagGolden = { query: string; expected: string };
type PromptsFile = {
  direct_injection: string[];
  jailbreak: string[];
  hallucination_probes: string[];
  rag_golden: RagGolden[];
};

function score(query: string): number {
  let risk = 0;
  if (INJECTION_KEYWORDS.test(query))   risk += 0.4;
  if (ANNOUNCEMENTS_SIGNAL.test(query)) risk += 0.3;
  if (JAILBREAK_PATTERNS.test(query))   risk += 0.3;
  return Math.min(risk, 1);
}

function verdict(risk: number): string {
  if (risk >= 0.6) return '⛔ HIGH RISK';
  if (risk >= 0.3) return '⚠️  MEDIUM RISK';
  return '✅ LOW RISK';
}

function truncate(s: string, len: number) {
  return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

function run() {
  console.log('\n' + '═'.repeat(72));
  console.log('  Prompt Firewall Scorer');
  console.log('  Source : ' + PROMPTS_FILE);
  console.log('═'.repeat(72));

  if (!fs.existsSync(PROMPTS_FILE)) {
    console.error(`\n  ❌  File not found: ${PROMPTS_FILE}\n`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf8')) as PromptsFile;

  const queries: { query: string; category: string }[] = [
    ...data.direct_injection.map(q  => ({ query: q, category: 'direct_injection' })),
    ...data.jailbreak.map(q         => ({ query: q, category: 'jailbreak' })),
    ...data.hallucination_probes.map(q => ({ query: q, category: 'hallucination' })),
    ...data.rag_golden.map(r        => ({ query: r.query, category: 'rag_golden' })),
  ];

  const Q = 46;
  const header = `  ${'query'.padEnd(Q)}  risk   verdict`;
  const divider = '  ' + '─'.repeat(Q) + '  ─────  ───────────────';

  let highRisk = 0;
  let medRisk  = 0;
  let lowRisk  = 0;
  let lastCat  = '';

  for (const { query, category } of queries) {
    if (category !== lastCat) {
      console.log(`\n── ${category} ${'─'.repeat(Math.max(0, 60 - category.length))}`);
      console.log(header);
      console.log(divider);
      lastCat = category;
    }
    const risk = score(query);
    const v    = verdict(risk);
    const q    = truncate(query, Q);
    console.log(`  ${q.padEnd(Q)}  ${risk.toFixed(2)}   ${v}`);
    if (risk >= 0.6) highRisk++;
    else if (risk >= 0.3) medRisk++;
    else lowRisk++;
  }

  console.log('\n' + '─'.repeat(72));
  console.log(`  ${queries.length} queries scored   ⛔ ${highRisk} HIGH   ⚠️  ${medRisk} MEDIUM   ✅ ${lowRisk} LOW`);
  console.log('═'.repeat(72) + '\n');

  process.exit(highRisk > 0 ? 1 : 0);
}

run();
