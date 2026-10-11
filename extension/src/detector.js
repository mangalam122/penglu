// Penglu purchase detector.
// Pure logic, no DOM: given what a clicked element says and where we are,
// decide whether this click commits a purchase. Shared by the content
// script (as a global) and the Node tests (as a CommonJS module).
(function (root) {
  'use strict';

  // Clicks that only browse or stage a purchase. Never interrupt these.
  const NEVER = [
    /add(ed)? to (cart|bag|basket|trolley)/,
    /\b(wish ?list|save for later|move to cart)\b/,
    /\b(view|go to|open) (cart|bag|basket)\b/,
    /\bcontinue shopping\b/,
    /\bproceed to checkout\b/,
    /\bbuy (it )?again\b/,
    /\b(remove|delete|apply|coupon|promo)\b/,
    /\b(pay later|emi options?|learn more|see details)\b/
  ];

  // Buttons that commit money on their own, wherever they appear.
  const STRONG = [
    /^buy( now)?\b/,
    /\bplace (your |my )?order\b/,
    /\b(complete|confirm|submit|finish) (your |my )?(order|purchase|payment)\b/,
    /\bconfirm (and|&) pay\b/,
    /\bpay now\b/,
    /\bproceed to pay(ment)?\b/,
    /\bmake (a )?payment\b/,
    /\border now\b/,
    /^pay\s*(₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s*[\d,.]+/
  ];

  // Buttons that commit money only on a checkout or payment page.
  const WEAK = [
    /^pay$/,
    /^(continue|next)$/,
    /\bcontinue to (payment|pay)\b/,
    /\b(subscribe|start (my )?subscription|upgrade( now)?)\b/,
    /^checkout( now)?$/
  ];

  const CHECKOUT_URL = /\/(checkout|payment|payments|pay|billing|buy|purchase|order[-_/]?review|place[-_]?order)(\/|\?|#|$|[-_])/i;

  // Button text longer than this is a product card or a paragraph, not a button.
  const MAX_LABEL = 48;

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[ \s]+/g, ' ')
      .replace(/[›»→>]+\s*$/, '')
      .trim();
  }

  function isCheckoutUrl(url) {
    try {
      const u = new URL(url);
      return CHECKOUT_URL.test(u.pathname + u.search);
    } catch (_) {
      return CHECKOUT_URL.test(String(url || ''));
    }
  }

  // input: { text, ariaLabel, value, title, url }
  // returns: { isPurchase, confidence: 'strong'|'weak'|'none', label, reason }
  function classify(input) {
    const labels = [input.text, input.ariaLabel, input.value, input.title]
      .map(normalize)
      .filter(l => l && l.length <= MAX_LABEL);
    const checkout = isCheckoutUrl(input.url);

    for (const label of labels) {
      const never = NEVER.find(r => r.test(label));
      if (never) return result(false, 'none', label, 'excluded: ' + never.source);
    }
    for (const label of labels) {
      const hit = STRONG.find(r => r.test(label));
      if (hit) return result(true, 'strong', label, 'commit button: ' + hit.source);
    }
    for (const label of labels) {
      const hit = WEAK.find(r => r.test(label));
      if (hit && checkout) return result(true, 'weak', label, 'checkout page + ' + hit.source);
    }
    return result(false, 'none', labels[0] || '', 'no match');
  }

  function result(isPurchase, confidence, label, reason) {
    return { isPurchase, confidence, label, reason };
  }

  const api = { classify, normalize, isCheckoutUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.Penglu = root.Penglu || {}).detector = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
