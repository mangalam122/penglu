// Penglu price finder. Given a page (and, when known, the clicked button),
// returns the price the user is about to pay, or null. Never guesses from the
// first ₹ on the page: banners and offers are full of prices that aren't
// the order. Sources, most trusted first:
//   1. the button itself ("Pay ₹9,995")
//   2. an order-total row ("Order Total", "Total Amount", "To Pay"…)
//   3. structured product data (JSON-LD, itemprop, meta tags)
//   4. a bare price right next to the clicked button
//   5. known shop selectors and price-looking elements
(function (root) {
  'use strict';

  const priceLib = (typeof module !== 'undefined' && module.exports)
    ? require('./price.js') : root.Penglu.price;
  const { parsePrice } = priceLib;

  // Ranked: earlier entries are more specific about being the final amount.
  const TOTAL_LABELS = [
    /^(order|grand|final|cart) total\b/i,
    /^(total (amount|payable|price|to pay|due))\b/i,
    /^(amount (payable|to pay|due))\b/i,
    /^(you pay|to pay|net payable|payable amount)\b/i,
    /^total\b(?!\s*(ratings?|reviews?|savings?|items?|discount))/i
  ];

  const STRUCK_CLASS = /\b(mrp|strike|strik|was-?price|old-?price|list-?price|a-text-price|original-?price|compare)\b/i;
  const PURE_PRICE = /^\s*[-−]?\s*(₹|rs\.?|inr|s\$|sgd|\$|usd|€|eur|£|gbp)\s*[\d][\d,]*(\.\d{1,2})?\s*$/i;

  const SHOP_SELECTORS = [
    '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
    '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
    '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
    '.grand-total-price',
    '.pdp-price strong'
  ];

  const text = el => (el && (el.innerText != null ? el.innerText : el.textContent) || '').replace(/\s+/g, ' ').trim();

  function isStruck(el) {
    for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) {
      if (/^(S|DEL|STRIKE)$/.test(e.tagName)) return true;
      if (STRUCK_CLASS.test(e.className && e.className.baseVal == null ? e.className : '')) return true;
      const style = (e.getAttribute && e.getAttribute('style')) || '';
      if (/line-through/.test(style)) return true;
      const view = e.ownerDocument && e.ownerDocument.defaultView;
      if (view && view.getComputedStyle) {
        const deco = view.getComputedStyle(e).textDecorationLine || view.getComputedStyle(e).textDecoration || '';
        if (/line-through/.test(deco)) return true;
      }
    }
    // "M.R.P.: ₹12,999" or "MRP ₹12,999" in a short parent line
    const parentText = text(el.parentElement);
    if (parentText.length < 40 && /\bm\.?r\.?p\.?\b/i.test(parentText)) return true;
    return false;
  }

  function leaves(scope) {
    return Array.from(scope.querySelectorAll('*')).filter(e => e.children.length === 0 && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(e.tagName));
  }

  function pricedLeaf(el) {
    const t = text(el);
    if (t.length > 24 || !PURE_PRICE.test(t) || /[-−]/.test(t) || isStruck(el)) return null;
    return parsePrice(t);
  }

  // 2. Order total rows: a label leaf, with the amount in itself, its
  // next sibling, or a short parent row.
  function fromTotals(doc, clicked) {
    const hits = [];
    for (const el of leaves(doc.body || doc)) {
      const t = text(el);
      if (t.length > 40) continue;
      const rank = TOTAL_LABELS.findIndex(r => r.test(t));
      if (rank < 0) continue;
      const sib = el.nextElementSibling;
      const parent = el.parentElement;
      const price = parsePrice(t) ||
        (sib && text(sib).length <= 40 && parsePrice(text(sib))) ||
        (parent && text(parent).length <= 60 && parsePrice(text(parent)));
      if (price) hits.push({ price, rank, el });
    }
    if (!hits.length) return null;
    const best = Math.min(...hits.map(h => h.rank));
    const top = hits.filter(h => h.rank === best);
    if (clicked) top.sort((a, b) => distance(a.el, clicked) - distance(b.el, clicked));
    else top.reverse(); // summaries usually end with the grand total
    return top[0].price;
  }

  // 3. Structured data.
  function fromStructured(doc) {
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(s.textContent); } catch (_) { continue; }
      const found = findOffer(data);
      if (found) return found;
    }
    const itemprop = doc.querySelector('[itemprop=price]');
    if (itemprop) {
      const amount = Number(String(itemprop.getAttribute('content') || text(itemprop)).replace(/[^\d.]/g, ''));
      const cur = doc.querySelector('[itemprop=priceCurrency]');
      if (amount > 0) return { amount, currency: (cur && (cur.getAttribute('content') || text(cur))) || 'INR' };
    }
    const meta = n => { const m = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`); return m && m.content; };
    const amount = Number(String(meta('product:price:amount') || meta('og:price:amount') || '').replace(/,/g, ''));
    if (amount > 0) return { amount, currency: meta('product:price:currency') || meta('og:price:currency') || 'INR' };
    return null;
  }

  function findOffer(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 6) return null;
    if (Array.isArray(node)) {
      for (const n of node) { const f = findOffer(n, depth + 1); if (f) return f; }
      return null;
    }
    const type = [].concat(node['@type'] || []).join(' ');
    if (/Offer/.test(type)) {
      const amount = Number(String(node.price != null ? node.price : node.lowPrice || '').replace(/,/g, ''));
      if (amount > 0) return { amount, currency: node.priceCurrency || 'INR' };
    }
    for (const key of ['offers', '@graph', 'mainEntity', 'itemOffered']) {
      const f = findOffer(node[key], depth + 1);
      if (f) return f;
    }
    return null;
  }

  // 4. The nearest bare price around the clicked button.
  function fromNearButton(clicked) {
    let scope = clicked && clicked.parentElement;
    for (let i = 0; scope && i < 5; scope = scope.parentElement, i++) {
      if (text(scope).length > 4000) break; // too big to still be "next to" the button
      for (const el of leaves(scope)) {
        const p = pricedLeaf(el);
        if (p) return p;
      }
    }
    return null;
  }

  // 5. Known shops, then anything whose class says "price".
  function fromSelectors(doc) {
    for (const sel of SHOP_SELECTORS) {
      for (const el of doc.querySelectorAll(sel)) {
        if (isStruck(el)) continue;
        const p = parsePrice(text(el));
        if (p) return p;
      }
    }
    for (const el of doc.querySelectorAll('[class*="price" i], [id*="price" i], [data-testid*="price" i]')) {
      if (el.children.length) continue;
      const p = pricedLeaf(el);
      if (p) return p;
    }
    return null;
  }

  function distance(a, b) {
    const chain = new Set();
    for (let e = a; e; e = e.parentElement) chain.add(e);
    let up = 0, e = b;
    while (e && !chain.has(e)) { e = e.parentElement; up++; }
    let down = 0;
    for (let x = a; x && x !== e; x = x.parentElement) down++;
    return up + down;
  }

  // findPrice(doc, { clicked, label }) -> { price, source }
  function findPrice(doc, opts = {}) {
    const steps = [
      ['button', () => opts.label && parsePrice(opts.label)],
      ['order total', () => fromTotals(doc, opts.clicked)],
      ['product data', () => fromStructured(doc)],
      ['next to button', () => fromNearButton(opts.clicked)],
      ['price element', () => fromSelectors(doc)]
    ];
    for (const [source, step] of steps) {
      let price = null;
      try { price = step(); } catch (_) { price = null; }
      if (price && price.amount > 0) return { price, source };
    }
    return { price: null, source: 'none' };
  }

  const api = { findPrice, isStruck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.Penglu = root.Penglu || {}).pricefinder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
