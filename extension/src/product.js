// Penglu product reader. Recognises a product page and pulls out what the
// ledger needs: name, price, image, and a link that will still work later
// (the product page, never the checkout page, which expires).
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const finder = isNode ? require('./pricefinder.js') : root.Penglu.pricefinder;

  const PRODUCT_PATH = /\/(dp|gp\/product|p|product|products|item|itm|buy)\/|\/[^/]+\/p\/|\/\d{5,}\/buy/i;

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const meta = (doc, n) => {
    const m = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
    return m && m.content;
  };

  function jsonLdProduct(doc) {
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(s.textContent); } catch (_) { continue; }
      const found = walk(data);
      if (found) return found;
    }
    return null;
    function walk(node, depth = 0) {
      if (!node || typeof node !== 'object' || depth > 5) return null;
      if (Array.isArray(node)) { for (const n of node) { const f = walk(n, depth + 1); if (f) return f; } return null; }
      if (/\bProduct\b/.test([].concat(node['@type'] || []).join(' '))) return node;
      return walk(node['@graph'], depth + 1) || walk(node.mainEntity, depth + 1);
    }
  }

  function isProductPage(doc, url) {
    if (jsonLdProduct(doc)) return true;
    if (/product/i.test(meta(doc, 'og:type') || '')) return true;
    if (doc.querySelector('#productTitle, [itemtype*="schema.org/Product"]')) return true;
    try { return PRODUCT_PATH.test(new URL(url).pathname) && !!doc.querySelector('h1'); } catch (_) { return false; }
  }

  function readProduct(doc, url) {
    const ld = jsonLdProduct(doc);
    const h1 = doc.querySelector('#productTitle') || doc.querySelector('h1');
    const name = clean(ld && ld.name) || clean(h1 && h1.textContent) || clean(meta(doc, 'og:title')) || clean(doc.title);
    let image = ld && [].concat(ld.image || [])[0];
    if (image && typeof image === 'object') image = image.url;
    image = image || meta(doc, 'og:image') || null;
    const canonical = doc.querySelector('link[rel=canonical]');
    const link = (canonical && canonical.href) || meta(doc, 'og:url') || url;
    const { price } = finder.findPrice(doc, {});
    return { name: name.slice(0, 140), price, image, url: stripTracking(link) };
  }

  // Keep the link short and shareable: drop tracking parameters.
  function stripTracking(href) {
    try {
      const u = new URL(href);
      [...u.searchParams.keys()].forEach(k => {
        if (/^(utm_|ref|tag|pf_rd|pd_rd|qid|sr|crid|sprefix|keywords|_encoding|psc|content-id|smid|th|lid|marketplace|store|srno|iid|ssid|otracker|fm|spm|ppt|ppn)/i.test(k)) u.searchParams.delete(k);
      });
      u.hash = '';
      return u.toString();
    } catch (_) { return href; }
  }

  const api = { isProductPage, readProduct, stripTracking };
  if (isNode) module.exports = api;
  else (root.Penglu = root.Penglu || {}).product = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
