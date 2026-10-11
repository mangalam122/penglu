const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/script.js');

test('work hours rounds to one decimal and refuses bad input', () => {
  assert.equal(S.workHours(9995, 1612), 6.2);
  assert.equal(S.workHours(500, 1000), 0.5);
  assert.equal(S.workHours(0, 1000), null);
  assert.equal(S.workHours(500, 0), null);
  assert.equal(S.workHours(500, undefined), null);
});

test('lines are filled from context and missing values read naturally', () => {
  const l = S.line('cost', { hours: 6.2, price: '₹9,995', name: 'a keyboard' }, 1);
  assert.equal(l.text, '₹9,995 comes to 6.2 hours of your labour, sir. A long shift for a keyboard.');
  assert.equal(l.mood, 'pained');
  assert.equal(S.fill('Why {name}?', {}), 'Why it?');
});

test('line index wraps around the pool', () => {
  const n = S.LINES.beg.length;
  assert.equal(S.line('beg', {}, n).text, S.line('beg', {}, 0).text);
  assert.equal(S.line('beg', {}, -1).text, S.line('beg', {}, n - 1).text);
});

test('importance reaction depends on the score', () => {
  assert.equal(S.reaction('importance', 9, {}).mood, 'composed');
  assert.equal(S.reaction('importance', 3, {}).mood, 'pained');
  assert.match(S.reaction('importance', 3, { price: '₹500' }).text, /3/);
});

test('owning nothing similar gets no scolding', () => {
  assert.equal(S.reaction('own', 'No', {}), null);
  assert.equal(S.reaction('own', 'Yes', {}).mood, 'despair');
});

test('every question has a line and a known kind', () => {
  for (const q of S.QUESTIONS) {
    assert.ok(['text', 'scale', 'choice'].includes(q.kind), q.id);
    assert.ok(S.questionLine(q, { name: 'x' }).text.length > 0);
  }
  assert.equal(S.HOLD_SECONDS, 120);
});

test('repeat-attempt line names the attempt', () => {
  const l = S.line('repeat', { n: 'third' }, 0);
  assert.match(l.text, /third attempt this week/);
  assert.equal(l.mood, 'raised_eyebrow');
});
