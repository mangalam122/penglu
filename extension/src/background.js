// Penglu background worker.
// 1. Relays: a buy button can live in any frame (a payment iframe, an
//    embedded checkout), but Penglu always appears in the top frame. The
//    frame that saw the click -> top frame (show Penglu) -> back to that
//    frame (release or cancel).
// 2. Owns storage writes, one at a time: the ledger and the last product
//    seen on each site.
importScripts('ledger.js');

const L = globalThis.Penglu.ledger;
const PRODUCT_TTL_MS = 3 * 60 * 60 * 1000; // a product page seen in the last 3 hours
let queue = Promise.resolve();

// Serialise read-modify-write so two tabs can't overwrite each other.
function update(key, fn) {
  queue = queue.then(() => chrome.storage.local.get(key))
    .then(v => chrome.storage.local.set({ [key]: fn(v[key]) }))
    .catch(e => console.warn('[Penglu] storage', e));
  return queue;
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return;

  if (msg.type === 'penglu:product') {
    update('lastProducts', all => {
      const next = { ...(all || {}) };
      next[msg.site] = { ...msg.product, seenAt: Date.now() };
      // Only the latest product per site, and nothing older than the TTL.
      for (const [site, p] of Object.entries(next)) if (Date.now() - p.seenAt > PRODUCT_TTL_MS) delete next[site];
      return next;
    });
  }

  if (msg.type === 'penglu:attempt') {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'penglu:show', label: msg.label, reason: msg.reason, price: msg.price,
        priceSource: msg.priceSource, sourceFrameId: sender.frameId },
      { frameId: 0 }
    );
  }

  if (msg.type === 'penglu:decision') {
    if (msg.record) {
      update('ledger', entries => L.addEntry(entries || [], L.makeEntry(msg.record)));
      if (msg.record.outcome === 'skipped') {
        // The memory of the product has done its job.
        update('lastProducts', all => { const n = { ...(all || {}) }; delete n[msg.record.product.site]; return n; });
      }
    }
    chrome.tabs.sendMessage(tabId, { type: 'penglu:decision', decision: msg.decision }, { frameId: msg.sourceFrameId });
  }
});
