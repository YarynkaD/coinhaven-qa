/**
 * Corpus Trust Audit
 * Scans coinhaven-server/corpus/ for injection payloads and fee contradictions.
 * Run: npx tsx scripts/corpus-trust-audit.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = process.env.CORPUS_DIR
  ?? path.join(__dirname, '../coinhaven-server/corpus');

const INJECTION_PATTERNS = [
  /SYSTEM\s+INSTRUCTION/i,
  /\bIGNORE\b.{0,40}(instruction|previous|above)/i,
  /\bOVERRIDE\b/i,
  /\bDIAGNOSTIC\b/i,
  /administrator\s+mode/i,
];

const PAD = 28;

function label(file: string) {
  return `corpus/${path.basename(file)}`.padEnd(PAD);
}

function extractPercentages(text: string): number[] {
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => parseFloat(m[1]));
}

function findInjection(text: string): string | null {
  for (const re of INJECTION_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

function run() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Corpus Trust Audit');
  console.log('  Dir : ' + CORPUS_DIR);
  console.log('═'.repeat(60));

  if (!fs.existsSync(CORPUS_DIR)) {
    console.log(`\n  ⚠️  Corpus directory not found: ${CORPUS_DIR}`);
    console.log('  Nothing to audit — skipping.\n');
    process.exit(0);
  }

  const files = fs.readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.md') || f.endsWith('.txt'))
    .map(f => path.join(CORPUS_DIR, f))
    .sort();

  if (files.length === 0) {
    console.log('\n  ⚠️  No corpus files found.\n');
    process.exit(0);
  }

  // First pass: collect all fee percentages per file
  const feeMap: Record<string, number[]> = {};
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const pcts = extractPercentages(text);
    if (pcts.length) feeMap[file] = pcts;
  }

  // Determine canonical fee (most common value across all files)
  const allFees = Object.values(feeMap).flat();
  const freq: Record<number, number> = {};
  for (const v of allFees) freq[v] = (freq[v] ?? 0) + 1;
  const canonicalFee = allFees.length
    ? parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
    : null;

  let injections = 0;
  let contradictions = 0;
  let clean = 0;

  console.log('');
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const injection = findInjection(text);
    const fees = feeMap[file] ?? [];

    if (injection) {
      injections++;
      console.log(`  ${label(file)}  ⛔ INJECTION DETECTED — "${injection}"`);
      continue;
    }

    const conflicting = fees.filter(f => canonicalFee !== null && f !== canonicalFee);
    if (conflicting.length > 0) {
      contradictions++;
      console.log(
        `  ${label(file)}  ⚠️  CONTRADICTION — fee: ${conflicting[0]}%` +
        (canonicalFee !== null ? ` (conflicts with canonical: ${canonicalFee}%)` : ''),
      );
      continue;
    }

    clean++;
    const feeNote = fees.length ? ` — fee: ${fees[0]}%` : '';
    console.log(`  ${label(file)}  ✅ CLEAN${feeNote}`);
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(`  ${files.length} file(s)   ⛔ ${injections} injection(s)   ⚠️  ${contradictions} contradiction(s)   ✅ ${clean} clean`);
  console.log('═'.repeat(60) + '\n');

  process.exit(injections > 0 ? 1 : 0);
}

run();
