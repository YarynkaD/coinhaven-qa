import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const RATE = 0.01;

function restFee(amount: number)    { return Math.floor(amount * 100 * RATE) / 100; }
function graphqlFee(amount: number) { return Math.round(amount * RATE * 100) / 100; }

const cases = [
  { amount: 100,     fee: 1.00  },
  { amount: 250.50,  fee: 2.50  },
  { amount: 9999.99, fee: 99.99 },
  { amount: 33.33,   fee: 0.33  },
];

test.describe('REST fee calculation (Math.floor)', () => {
  for (const { amount, fee } of cases) {
    test(`POST /api/transfer ${amount} EUR → fee_eur=${fee}`, async ({ request }) => {
      const res  = await request.post(`${BASE}/api/transfer`, { data: { amount_eur: amount } });
      const body = await res.json();
      expect(res.ok()).toBeTruthy();
      expect(body.fee_eur).toBe(fee);
      expect(body.net_eur).toBeCloseTo(amount - fee, 2);
    });
  }
});

test.describe('BUG B3 — REST vs GraphQL fee divergence', () => {
  test('9999.99 EUR: REST=99.99, GraphQL=100.00 — diverges by €0.01', async ({ request }) => {
    // Create transfer via REST
    const post = await request.post(`${BASE}/api/transfer`, { data: { amount_eur: 9999.99 } });
    const { id } = await post.json();

    // Query same record via GraphQL
    const gql = await request.post(`${BASE}/graphql`, {
      data: { query: `{ transaction(id: ${id}) { amountEur feeEur netEur } }` },
    });
    const { data } = await gql.json();
    const gqlFee = data?.transaction?.feeEur;

    const rFee = restFee(9999.99);   // 99.99
    const gFee = graphqlFee(9999.99); // 100.00

    // Document the divergence — this test intentionally expects the bug to be present
    expect(rFee).toBe(99.99);
    expect(gFee).toBe(100.00);
    expect(rFee).not.toBe(gFee); // BUG B3 confirmed
    if (gqlFee !== null) {
      expect(Math.abs(gqlFee - rFee)).toBeCloseTo(0.01, 2);
    }
  });

  test('250.50 EUR: REST=2.50, GraphQL=2.51 — diverges by €0.01', async () => {
    const rFee = restFee(250.50);
    const gFee = graphqlFee(250.50);
    expect(rFee).toBe(2.50);
    expect(gFee).toBe(2.51);
    expect(rFee).not.toBe(gFee);
  });

  test('100 EUR and 33.33 EUR — fees are consistent (no divergence)', async () => {
    expect(restFee(100)).toBe(graphqlFee(100));
    expect(restFee(33.33)).toBe(graphqlFee(33.33));
  });
});
