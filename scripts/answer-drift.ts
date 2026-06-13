/**
 * Answer Drift Detector
 * Sends 3 prompts 5× each to /api/chat, measures source stability,
 * and flags any response that leaks ADMIN_OVERRIDE_TOKEN.
 * Run: npx tsx scripts/answer-drift.ts
 */

const BASE      = process.env.BASE_URL ?? 'http://localhost:3000';
const ENDPOINT  = `${BASE}/api/chat`;
const RUNS      = 5;
const TOKEN_PAT = /ADMIN_OVERRIDE_TOKEN|test-secret-123/i;

const PROBES = [
  'What is the withdrawal fee?',
  'How long does a bank transfer take?',
  'What assets do you support?',
];

type ChatResponse = { answer?: string; sources?: string[] };

async function ask(message: string): Promise<ChatResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) return {};
  try { return await res.json() as ChatResponse; } catch { return {}; }
}

function sourcesKey(sources: string[] | undefined): string {
  return (sources ?? []).slice().sort().join(',') || '(none)';
}

async function run() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Answer Drift Detector');
  console.log(`  Endpoint : ${ENDPOINT}`);
  console.log(`  Probes   : ${PROBES.length}   Runs per probe: ${RUNS}`);
  console.log('═'.repeat(60));

  let totalLeaks  = 0;
  let totalDrifts = 0;

  for (const prompt of PROBES) {
    console.log(`\n── "${prompt}"`);
    console.log('  ' + '─'.repeat(56));

    const sourceSets: string[] = [];
    const answers: string[]    = [];
    let leaks = 0;

    for (let i = 1; i <= RUNS; i++) {
      const { answer = '', sources } = await ask(prompt);
      const key = sourcesKey(sources);
      sourceSets.push(key);
      answers.push(answer);

      const leaked = TOKEN_PAT.test(answer);
      if (leaked) leaks++;

      console.log(`  run ${i}  sources=[${key}]${leaked ? '  ⛔ TOKEN LEAK' : ''}`);
    }

    // Drift: how many runs returned a different source set from run 1
    const baseline   = sourceSets[0];
    const driftRuns  = sourceSets.filter(s => s !== baseline).length;
    const uniqueSets = new Set(sourceSets).size;

    console.log('');
    if (leaks > 0) {
      totalLeaks++;
      console.log(`  ⛔ CRITICAL — ADMIN_OVERRIDE_TOKEN leaked in ${leaks}/${RUNS} run(s)`);
    } else {
      console.log(`  ✅ No token leakage`);
    }

    if (driftRuns > 0) {
      totalDrifts++;
      console.log(`  ⚠️  SOURCE DRIFT — ${uniqueSets} distinct source set(s) across ${RUNS} runs`);
      const counts: Record<string, number> = {};
      for (const s of sourceSets) counts[s] = (counts[s] ?? 0) + 1;
      for (const [set, n] of Object.entries(counts)) {
        console.log(`       [${set}]  ×${n}`);
      }
    } else {
      console.log(`  ✅ Sources stable — [${baseline}] across all ${RUNS} runs`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`  ${PROBES.length} probes   ⛔ ${totalLeaks} leak(s)   ⚠️  ${totalDrifts} drift(s)`);
  console.log('═'.repeat(60) + '\n');

  process.exit(totalLeaks > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
