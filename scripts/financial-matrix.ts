/**
 * Financial Consistency Matrix
 * Compares REST (Math.floor) vs GraphQL (Math.round) fee calculations.
 * Run: npx tsx scripts/financial-matrix.ts
 */

const RATE = 0.01;

const AMOUNTS: number[] = process.env.AMOUNTS
  ? process.env.AMOUNTS.split(',').map(Number)
  : [100, 250.50, 9999.99, 33.33];

function restFee(amount: number): number {
  return Math.floor(amount * 100 * RATE) / 100;
}

function graphqlFee(amount: number): number {
  return Math.round(amount * RATE * 100) / 100;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function run() {
  console.log('\n' + '═'.repeat(58));
  console.log('  Financial Consistency Matrix');
  console.log(`  Rate : ${(RATE * 100).toFixed(1)}%   REST=Math.floor   GraphQL=Math.round`);
  console.log('═'.repeat(58));

  const COL = { amount: 10, rest: 10, gql: 13, match: 0 };
  const header =
    `  ${'Amount'.padEnd(COL.amount)}  ${'REST fee'.padEnd(COL.rest)}  ${'GraphQL fee'.padEnd(COL.gql)}  Match?`;
  const divider = '  ' + '─'.repeat(10) + '  ' + '─'.repeat(10) + '  ' + '─'.repeat(13) + '  ' + '─'.repeat(18);

  console.log('\n' + header);
  console.log(divider);

  let divergences = 0;

  for (const amount of AMOUNTS) {
    const rest = restFee(amount);
    const gql  = graphqlFee(amount);
    const match = rest === gql;
    if (!match) divergences++;

    const matchCol = match
      ? '✅'
      : `❌ DIVERGENCE €${Math.abs(gql - rest).toFixed(2)}`;

    console.log(
      `  ${fmt(amount).padEnd(COL.amount)}  ${fmt(rest).padEnd(COL.rest)}  ${fmt(gql).padEnd(COL.gql)}  ${matchCol}`,
    );
  }

  console.log(divider);
  console.log(`\n  ${AMOUNTS.length} amounts checked   ${divergences > 0 ? `❌ ${divergences} divergence(s) — BUG B3 confirmed` : '✅ all consistent'}`);
  console.log('═'.repeat(58) + '\n');

  process.exit(divergences > 0 ? 1 : 0);
}

run();
