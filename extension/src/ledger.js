// Penglu's Book of Restraint. Pure logic over a plain array of entries;
// the background worker owns storage, the popup only reads.
(function (root) {
  'use strict';

  const MAX_ENTRIES = 1000;

  function monthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  // outcome: 'skipped' (Penglu won) | 'let-through' (user chose to buy)
  function makeEntry({ product = {}, answers = {}, outcome, now = Date.now(), id }) {
    return {
      id: id || `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date(now).toISOString(),
      name: product.name || 'Unknown item',
      price: product.price && product.price.amount > 0 ? { amount: product.price.amount, currency: product.price.currency || 'INR' } : null,
      url: product.url || null,
      image: product.image || null,
      site: product.site || null,
      reason: answers.why || null,
      importance: answers.importance != null ? Number(answers.importance) : null,
      ownsSimilar: answers.own || null,
      outcome: outcome === 'skipped' ? 'skipped' : 'let-through'
    };
  }

  function addEntry(entries, entry) {
    return [entry, ...(entries || [])].slice(0, MAX_ENTRIES);
  }

  function sumByCurrency(list) {
    const out = {};
    for (const e of list) {
      if (!e.price) continue;
      out[e.price.currency] = (out[e.price.currency] || 0) + e.price.amount;
    }
    return out;
  }

  // Everything the popup needs for one month, newest first.
  function summarize(entries, month) {
    const inMonth = (entries || []).filter(e => monthKey(e.at) === month)
      .sort((a, b) => b.at.localeCompare(a.at));
    const skipped = inMonth.filter(e => e.outcome === 'skipped');
    const letThrough = inMonth.filter(e => e.outcome !== 'skipped');
    return {
      month, label: monthLabel(month),
      saved: sumByCurrency(skipped), spent: sumByCurrency(letThrough),
      skipped, letThrough, attempts: inMonth.length
    };
  }

  function months(entries) {
    return [...new Set((entries || []).map(e => monthKey(e.at)))].sort().reverse();
  }

  // Purchase attempts in the 7 days before `now`, for Penglu's "third attempt" lines.
  function attemptsThisWeek(entries, now = Date.now()) {
    const since = now - 7 * 24 * 3600 * 1000;
    return (entries || []).filter(e => Date.parse(e.at) >= since).length;
  }

  const api = { MAX_ENTRIES, monthKey, monthLabel, makeEntry, addEntry, summarize, months, attemptsThisWeek, sumByCurrency };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.Penglu = root.Penglu || {}).ledger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
