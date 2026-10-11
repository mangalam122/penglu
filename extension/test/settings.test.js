const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/settings.js');

const inr = amount => ({ amount, currency: 'INR' });

test('holds an ordinary purchase', () => {
  assert.deepEqual(S.shouldHold({}, { host: 'www.amazon.in', price: inr(9995) }), { hold: true, why: 'purchase' });
});

test('holds when the price is unknown', () => {
  assert.equal(S.shouldHold({}, { host: 'amazon.in', price: null }).hold, true);
});

test('stays quiet under the threshold', () => {
  assert.equal(S.shouldHold({}, { host: 'amazon.in', price: inr(499) }).why, 'under threshold');
  assert.equal(S.shouldHold({ threshold: 0 }, { host: 'amazon.in', price: inr(10) }).hold, true);
});

test('allowlisted sites and their subdomains pass', () => {
  assert.equal(S.shouldHold({}, { host: 'www.swiggy.com', price: inr(900) }).why, 'allowlisted');
  assert.equal(S.shouldHold({}, { host: 'instamart.swiggy.com', price: inr(900) }).why, 'allowlisted');
  assert.equal(S.shouldHold({}, { host: 'notswiggy.com', price: inr(900) }).hold, true);
});

test('snooze wins until it expires', () => {
  const now = 1_000_000;
  assert.equal(S.shouldHold({ snoozeUntil: now + 1 }, { host: 'amazon.in', price: inr(9995), now }).why, 'snoozed');
  assert.equal(S.shouldHold({ snoozeUntil: now - 1 }, { host: 'amazon.in', price: inr(9995), now }).hold, true);
});

test('defaults fill in missing settings', () => {
  const s = S.withDefaults({ hourlyRate: 1612 });
  assert.equal(s.hourlyRate, 1612);
  assert.equal(s.threshold, 500);
  assert.ok(s.allowlist.includes('blinkit.com'));
});
