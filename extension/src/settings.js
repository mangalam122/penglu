// Penglu settings and the one rule that uses them: should this click be held?
(function (root) {
  'use strict';

  const DEFAULTS = {
    hourlyRate: null,      // ₹ per hour, asked for on first use
    threshold: 500,        // stay quiet under this many rupees
    snoozeUntil: 0,        // epoch ms; 0 = awake
    // Groceries, food and medicines are needs, not impulses.
    allowlist: ['swiggy.com', 'zomato.com', 'blinkit.com', 'zeptonow.com', 'bigbasket.com',
      'jiomart.com', '1mg.com', 'pharmeasy.in', 'netmeds.com', 'apollopharmacy.in']
  };

  function withDefaults(stored) {
    return { ...DEFAULTS, ...(stored || {}), allowlist: (stored && stored.allowlist) || DEFAULTS.allowlist.slice() };
  }

  function normalizeHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '').trim();
  }

  function siteMatches(host, entry) {
    const h = normalizeHost(host), e = normalizeHost(entry);
    return !!e && (h === e || h.endsWith('.' + e));
  }

  // -> { hold: boolean, why: string }
  function shouldHold(settings, { host, price, now = Date.now() }) {
    const s = withDefaults(settings);
    if (s.snoozeUntil > now) return { hold: false, why: 'snoozed' };
    if (s.allowlist.some(e => siteMatches(host, e))) return { hold: false, why: 'allowlisted' };
    if (price && price.currency === 'INR' && s.threshold > 0 && price.amount < s.threshold) {
      return { hold: false, why: 'under threshold' };
    }
    return { hold: true, why: 'purchase' };
  }

  const api = { DEFAULTS, withDefaults, normalizeHost, siteMatches, shouldHold };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.Penglu = root.Penglu || {}).settings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
