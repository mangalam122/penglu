const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/ledger.js');

const at = s => Date.parse(s);
const kb = { name: 'Aurora 75', price: { amount: 9995, currency: 'INR' }, url: 'https://a.in/dp/1', site: 'a.in' };
const lamp = { name: 'Cat lamp', price: { amount: 2150, currency: 'INR' }, url: 'https://b.in/p/2', site: 'b.in' };

test('makeEntry keeps the product link and the answers', () => {
  const e = L.makeEntry({ product: kb, answers: { why: 'sticky spacebar', importance: '4', own: 'Yes' }, outcome: 'skipped', now: at('2026-10-11T18:12:00Z'), id: 'x' });
  assert.deepEqual(e, {
    id: 'x', at: '2026-10-11T18:12:00.000Z', name: 'Aurora 75', price: { amount: 9995, currency: 'INR' },
    url: 'https://a.in/dp/1', image: null, site: 'a.in', reason: 'sticky spacebar', importance: 4,
    ownsSimilar: 'Yes', outcome: 'skipped'
  });
});

test('unknown price is stored as null, not zero', () => {
  assert.equal(L.makeEntry({ product: { name: 'x' }, outcome: 'skipped' }).price, null);
});

test('summarize totals saved and spent for one month only', () => {
  let list = [];
  list = L.addEntry(list, L.makeEntry({ product: kb, outcome: 'skipped', now: at('2026-10-02T10:00:00') }));
  list = L.addEntry(list, L.makeEntry({ product: lamp, outcome: 'skipped', now: at('2026-10-05T10:00:00') }));
  list = L.addEntry(list, L.makeEntry({ product: lamp, outcome: 'let-through', now: at('2026-10-06T10:00:00') }));
  list = L.addEntry(list, L.makeEntry({ product: kb, outcome: 'skipped', now: at('2026-09-28T10:00:00') }));
  const s = L.summarize(list, '2026-10');
  assert.deepEqual(s.saved, { INR: 12145 });
  assert.deepEqual(s.spent, { INR: 2150 });
  assert.equal(s.skipped.length, 2);
  assert.equal(s.skipped[0].name, 'Cat lamp'); // newest first
  assert.equal(s.attempts, 3);
  assert.deepEqual(L.months(list), ['2026-10', '2026-09']);
});

test('entries are capped', () => {
  let list = [];
  for (let i = 0; i < L.MAX_ENTRIES + 5; i++) list = L.addEntry(list, { id: String(i), at: new Date().toISOString() });
  assert.equal(list.length, L.MAX_ENTRIES);
  assert.equal(list[0].id, String(L.MAX_ENTRIES + 4));
});

test('attempts this week', () => {
  const now = at('2026-10-11T12:00:00Z');
  const list = [
    { at: '2026-10-10T12:00:00Z' }, { at: '2026-10-05T12:00:00Z' }, { at: '2026-10-01T12:00:00Z' }
  ];
  assert.equal(L.attemptsThisWeek(list, now), 2);
});
