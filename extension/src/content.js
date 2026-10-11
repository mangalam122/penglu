// Penglu content script. Runs in every frame of every page.
// Listens for clicks in the capture phase, so it hears them before the
// site does. A purchase click is stopped dead; Penglu then holds it.
(function () {
  'use strict';

  const P = globalThis.Penglu;
  const PASS_MS = 5 * 60 * 1000;
  const CLICKABLE = [
    'button', 'a[href]', 'input[type=submit]', 'input[type=button]',
    'input[type=image]', '[role=button]', '[role=link]'
  ].join(',');

  const passes = new WeakMap(); // element -> pass expiry time
  let held = null;              // the element whose click is being held
  let settings = P.settings.withDefaults();

  chrome.storage.local.get('settings', v => { settings = P.settings.withDefaults(v.settings); });
  chrome.storage.onChanged.addListener(changes => {
    if (changes.settings) settings = P.settings.withDefaults(changes.settings.newValue);
  });

  // The shop's host, even from inside a payment iframe.
  function topHost() {
    const origins = location.ancestorOrigins;
    const origin = origins && origins.length ? origins[origins.length - 1] : location.origin;
    try { return P.settings.normalizeHost(new URL(origin).hostname); } catch (_) { return P.settings.normalizeHost(location.hostname); }
  }

  function clickableFrom(target) {
    let el = target;
    if (el && !(el instanceof Element)) el = el.parentElement;
    return el ? el.closest(CLICKABLE) : null;
  }

  function describe(el) {
    return {
      text: (el.innerText || el.textContent || '').trim(),
      ariaLabel: el.getAttribute('aria-label'),
      value: el.value != null ? el.value : el.getAttribute('value'),
      title: el.getAttribute('title'),
      url: location.href
    };
  }

  // Returns true when the click should go through untouched.
  function usePass(el) {
    const expiry = passes.get(el);
    if (!expiry) return false;
    passes.delete(el);
    return expiry > Date.now();
  }

  function hold(event, el) {
    if (!event.isTrusted) return; // only the user's own clicks
    if (usePass(el)) return;

    const verdict = P.detector.classify(describe(el));
    if (!verdict.isPurchase) return;

    const found = P.pricefinder.findPrice(document, { clicked: el, label: verdict.label });
    const rule = P.settings.shouldHold(settings, { host: topHost(), price: found.price });
    if (!rule.hold) return; // snoozed, allowlisted or under the threshold

    event.preventDefault();
    event.stopImmediatePropagation();
    if (held) return; // Penglu is already on it

    held = el;
    chrome.runtime.sendMessage({
      type: 'penglu:attempt', label: verdict.label, reason: verdict.reason,
      price: found.price, priceSource: found.source
    });
  }

  window.addEventListener('click', e => {
    const el = clickableFrom(e.target);
    if (el) hold(e, el);
  }, true);

  // Pressing Enter in a checkout form submits it without a click.
  window.addEventListener('submit', e => {
    const el = e.submitter || (e.target.querySelector && e.target.querySelector('[type=submit]'));
    if (el) hold(e, el);
  }, true);

  // ---- Top frame only ----

  // Remember the product page we're on, so that later, on a checkout page
  // that no longer shows it, Penglu still knows what is being bought and
  // can keep its link. Shops are single-page apps, so re-check on URL change.
  if (window === window.top) {
    let lastUrl = '';
    const remember = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      setTimeout(() => {
        try {
          if (!P.product.isProductPage(document, location.href)) return;
          const product = P.product.readProduct(document, location.href);
          chrome.runtime.sendMessage({ type: 'penglu:product', site: topHost(), product });
        } catch (e) { /* a page we can't read is fine */ }
      }, 1500); // let prices render
    };
    window.addEventListener('load', remember);
    setInterval(remember, 2000);
  }

  // Name and link from this page if it's a product page, else from the
  // remembered product. Price from the clicking frame when it found one.
  async function findProduct(msg) {
    const site = topHost();
    const here = P.product.isProductPage(document, location.href) ? P.product.readProduct(document, location.href) : null;
    let remembered = null;
    try {
      const { lastProducts } = await chrome.storage.local.get('lastProducts');
      remembered = lastProducts && lastProducts[site];
    } catch (_) { /* storage is optional */ }
    const base = here || remembered || {};
    const titled = document.querySelector('#productTitle, h1');
    const name = base.name || (titled && titled.innerText.trim()) || document.title;
    const found = msg.price ? { price: msg.price, source: msg.priceSource }
      : base.price ? { price: base.price, source: 'product page' }
      : P.pricefinder.findPrice(document, {});
    return {
      name: String(name || '').replace(/\s+/g, ' ').slice(0, 140),
      price: found.price, priceSource: found.source,
      image: base.image || null,
      site, url: base.url || location.href
    };
  }

  function decide(decision, sourceFrameId, record) {
    chrome.runtime.sendMessage({ type: 'penglu:decision', decision, sourceFrameId, record });
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === 'penglu:show' && window === window.top) {
      findProduct(msg).then(product => {
        const attempt = { label: msg.label, reason: msg.reason, product };
        P.overlay.show(attempt, (decision, details) => decide(decision, msg.sourceFrameId, {
          product, answers: details.answers, outcome: details.outcome
        }));
      });
    }

    if (msg.type === 'penglu:decision' && held) {
      // 'release': the user's next click on this button goes through.
      // 'cancel': nothing to do, the order was never placed.
      if (msg.decision === 'release') passes.set(held, Date.now() + PASS_MS);
      held = null;
    }
  });
})();
