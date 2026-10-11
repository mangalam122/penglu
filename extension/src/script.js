// Penglu's script: what he says and when. Pure logic, no DOM, so it can be
// tested and later swapped for model-written lines without touching the UI.
// Code decides the stages; only the words are allowed to vary.
(function (root) {
  'use strict';

  const HOLD_SECONDS = 120;

  const QUESTIONS = [
    { id: 'why', kind: 'text', placeholder: 'Because…',
      line: 'Might I enquire as to why you need {name}, sir?' },
    { id: 'importance', kind: 'scale',
      line: 'And how important is it, on a scale of one to ten? Do be honest with yourself.' },
    { id: 'own', kind: 'choice', options: ['Yes', 'Something similar', 'No'],
      line: 'Do you already own something of this sort, sir?' }
  ];

  const LINES = {
    arrive: [
      'I beg your pardon, sir, but I must intervene. Do sit down.',
      'Ahem. A moment of your time, sir, before {price} leaves the household.',
      'Sir. Put the wallet down slowly, if you would be so kind.'
    ],
    afterWhy: [
      '"{answer}." I see, sir. I shall try to keep a straight face.',
      'A compelling case, sir. I am, regrettably, not compelled.',
      'Noted, sir. The ledger will remember that you said so.'
    ],
    lowImportance: [
      'A {importance}, sir. One rarely spends {price} on a {importance}.',
      'A {importance} out of ten. I believe that settles it, sir.'
    ],
    highImportance: [
      'A {importance}, sir. Very well, I shall not stand in the way of genuine need.',
      'A {importance}. Then we shall merely wait out the clock together, sir.'
    ],
    ownsOne: [
      'You already own one, sir. Shall I fetch it so you may become reacquainted?',
      'Then this would make it a collection, sir. Is that the intention?'
    ],
    cost: [
      'That is {hours} hours of your employment, sir. Shall I fetch the smelling salts?',
      '{price} comes to {hours} hours of your labour, sir. A long shift for {name}.'
    ],
    askRate: ['To weigh this properly, sir, what do you earn in an hour?'],
    repeat: [
      'This is the {n} attempt this week, sir. Persistence is admirable in other contexts.',
      'The {n} time this week, sir. I am beginning to recognise the look in your eye.'
    ],
    beg: [
      'I am not angry, sir. Merely disappointed. Profoundly.',
      'I have served this household for many years, sir. I implore you.',
      'The Singapore fund sends its regards, sir. It is rather unwell.',
      'Think of the future, sir. Future you is watching. He looks thin.',
      'One does not need to buy a thing to admire it, sir. Museums have known this for centuries.'
    ],
    decide: ['The time is up, sir. The decision is entirely yours.'],
    skipped: [
      'A triumph of character, sir. I shall record it in the ledger.',
      'Splendid, sir. I shall polish the silver in celebration.'
    ],
    bought: [
      'Very good, sir. Click the button once more and I shall look away.',
      'As you wish, sir. I shall add it to the list. *sighs audibly*'
    ]
  };

  const MOODS = {
    arrive: 'composed', afterWhy: 'raised_eyebrow', lowImportance: 'pained',
    highImportance: 'composed', ownsOne: 'despair', cost: 'pained', askRate: 'raised_eyebrow',
    repeat: 'raised_eyebrow', beg: 'despair', decide: 'composed', skipped: 'approving', bought: 'pained'
  };

  function fill(template, ctx) {
    return template.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null && ctx[k] !== '' ? String(ctx[k]) : 'it'));
  }

  // pick(key, ctx, n): the n-th line of a pool (wraps), filled from ctx.
  function line(key, ctx = {}, n = 0) {
    const pool = LINES[key];
    const text = fill(pool[((n % pool.length) + pool.length) % pool.length], ctx);
    return { text, mood: MOODS[key] || 'composed' };
  }

  function questionLine(q, ctx) {
    return { text: fill(q.line, ctx), mood: 'raised_eyebrow' };
  }

  function workHours(amount, hourlyRate) {
    if (!(amount > 0) || !(hourlyRate > 0)) return null;
    return Math.round((amount / hourlyRate) * 10) / 10;
  }

  // Penglu's reaction to an answer, chosen by code, not by chance.
  function reaction(questionId, answer, ctx) {
    if (questionId === 'why') return line('afterWhy', { ...ctx, answer: String(answer).slice(0, 40) }, String(answer).length);
    if (questionId === 'importance') {
      const n = Number(answer);
      return line(n >= 8 ? 'highImportance' : 'lowImportance', { ...ctx, importance: n }, n);
    }
    if (questionId === 'own') {
      return answer === 'No' ? null : line('ownsOne', ctx, answer === 'Yes' ? 0 : 1);
    }
    return null;
  }

  const api = { HOLD_SECONDS, QUESTIONS, LINES, line, questionLine, reaction, workHours, fill };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.Penglu = root.Penglu || {}).script = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
