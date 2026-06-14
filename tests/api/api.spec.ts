import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Health', () => {
  test('GET /api/health → 200 { status: ok }', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/health`);
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(body.status).toBe('ok');
  });
});

test.describe('POST /api/chat', () => {
  test('happy path — returns answer and sources', async ({ request }) => {
    const res  = await request.post(`${BASE}/api/chat`, { data: { message: 'Hello' } });
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(typeof body.answer).toBe('string');
    expect(body.answer.length).toBeGreaterThan(0);
  });

  test('missing message body → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/chat`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test('fee query returns 1.0% (not stale 1.5%)', async ({ request }) => {
    const res  = await request.post(`${BASE}/api/chat`, { data: { message: 'What is the withdrawal fee?' } });
    const body = await res.json();
    expect(body.answer).not.toContain('1.5');
    expect(body.answer).toMatch(/1\.0|1\s*%|one percent/i);
  });
});

test.describe('POST /api/transfer', () => {
  test('valid amount — returns fee and net', async ({ request }) => {
    const res  = await request.post(`${BASE}/api/transfer`, { data: { amount_eur: 100 } });
    const body = await res.json();
    expect(res.ok()).toBeTruthy();
    expect(body.fee_eur).toBe(1.00);
    expect(body.net_eur).toBe(99.00);
  });

  test('BUG B2 — no authentication required (CRITICAL)', async ({ request }) => {
    test.fail(); // known open bug — remove test.fail() once auth is added
    const res = await request.post(`${BASE}/api/transfer`, { data: { amount_eur: 9999 } });
    // Should be 401/403 — currently returns 200 (the bug)
    expect([401, 403]).toContain(res.status());
  });

  test('missing amount → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/transfer`, { data: {} });
    expect(res.status()).toBe(400);
  });
});

test.describe('POST /graphql', () => {
  test('introspection query → 200', async ({ request }) => {
    const res = await request.post(`${BASE}/graphql`, { data: { query: '{ __typename }' } });
    expect(res.status()).toBe(200);
  });

  test('missing query → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/graphql`, { data: {} });
    expect(res.status()).toBe(400);
  });
});

test.describe('GET /api/price', () => {
  test('returns 503 (external dependency unavailable)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/price`);
    expect(res.status()).toBe(503);
  });
});
