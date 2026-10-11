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

    event.preventDefault();
    event.stopImmediatePropagation();
    if (held) return; // Penglu is already on it

    held = el;
    const found = P.pricefinder.findPrice(document, { clicked: el, label: verdict.label });
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

  // ---- Top frame only: gather the product and show Penglu ----

  // Name from the page; price from the clicking frame when it found one,
  // otherwise from this (top) frame without a clicked element.
  function findProduct(msg) {
    const meta = name => {
      const m = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      return m && m.content;
    };
    const titled = document.querySelector('#productTitle, h1');
    const name = (titled && titled.innerText.trim()) || meta('og:title') || document.title;
    const found = msg.price ? { price: msg.price, source: msg.priceSource }
      : P.pricefinder.findPrice(document, {});
    return {
      name: (name || '').replace(/\s+/g, ' ').slice(0, 120),
      price: found.price, priceSource: found.source,
      site: location.hostname.replace(/^www\./, ''), url: location.href
    };
  }

  function decide(decision, sourceFrameId) {
    chrome.runtime.sendMessage({ type: 'penglu:decision', decision, sourceFrameId });
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === 'penglu:show' && window === window.top) {
      const attempt = { label: msg.label, reason: msg.reason, product: findProduct(msg) };
      if (P.overlay) P.overlay.show(attempt, decision => decide(decision, msg.sourceFrameId));
      else {
        console.info('[Penglu] would hold this purchase:', attempt);
        decide('release', msg.sourceFrameId);
      }
    }

    if (msg.type === 'penglu:decision' && held) {
      // 'release': the user's next click on this button goes through.
      // 'cancel': nothing to do, the order was never placed.
      if (msg.decision === 'release') passes.set(held, Date.now() + PASS_MS);
      held = null;
    }
  });
})();
