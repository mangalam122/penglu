// Penglu's popup. Lives in a closed Shadow DOM so the shop's CSS can't touch
// Penglu and Penglu's CSS can't break the shop. Dims the page, holds the
// purchase for HOLD_SECONDS, walks through the script, then hands back a
// decision: 'cancel' (skipped) or 'release' (the user's next click goes through).
(function (root) {
  'use strict';

  const P = root.Penglu = root.Penglu || {};
  let open = false;

  const CSS = `
    :host { all: initial;
      --glass: rgba(250, 250, 252, .58); --glass-edge: rgba(255, 255, 255, .7); --glass-shade: rgba(0, 0, 0, .06);
      --fill: rgba(120, 120, 128, .14); --fill-strong: rgba(120, 120, 128, .22); --hair: rgba(60, 60, 67, .14);
      --ink: #1d1d1f; --ink-2: rgba(60, 60, 67, .62); --ink-3: rgba(60, 60, 67, .38);
      --accent: #0a7aff; --accent-ink: #fff; --warn: #ff9f0a;
      --scrim: rgba(242, 242, 247, .28);
      --shadow: 0 30px 80px -20px rgba(0, 0, 0, .35), 0 2px 8px rgba(0, 0, 0, .08);
      color-scheme: light; }
    @media (prefers-color-scheme: dark) { :host {
      --glass: rgba(36, 36, 40, .56); --glass-edge: rgba(255, 255, 255, .16); --glass-shade: rgba(0, 0, 0, .25);
      --fill: rgba(120, 120, 128, .24); --fill-strong: rgba(120, 120, 128, .34); --hair: rgba(255, 255, 255, .1);
      --ink: #f5f5f7; --ink-2: rgba(235, 235, 245, .62); --ink-3: rgba(235, 235, 245, .34);
      --accent: #0a84ff; --scrim: rgba(0, 0, 0, .28);
      --shadow: 0 30px 80px -20px rgba(0, 0, 0, .7), 0 2px 8px rgba(0, 0, 0, .3);
      color-scheme: dark; } }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; background: var(--scrim);
      -webkit-backdrop-filter: blur(10px) saturate(120%); backdrop-filter: blur(10px) saturate(120%);
      animation: fade .35s ease both; }
    .panel { position: fixed; left: 50%; top: 14vh; width: 620px; max-width: calc(100vw - 32px);
      transform: translateX(-50%);
      background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0) 40%), var(--glass);
      -webkit-backdrop-filter: blur(40px) saturate(190%); backdrop-filter: blur(40px) saturate(190%);
      border-radius: 28px; border: .5px solid var(--glass-edge);
      box-shadow: var(--shadow), inset 0 1px 0 var(--glass-edge), inset 0 -1px 0 var(--glass-shade);
      color: var(--ink); overflow: hidden;
      font: 15px/1.35 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      animation: rise .55s cubic-bezier(.2, .9, .3, 1.1) both; }
    @keyframes fade { from { opacity: 0 } }
    @keyframes rise { from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.96); filter: blur(6px); } }

    .field { display: flex; align-items: center; gap: 14px; padding: 16px 18px 16px 14px; position: relative; }
    .avatar { flex: none; width: 52px; height: 52px; border-radius: 16px; background: var(--fill);
      display: grid; place-items: center; overflow: hidden; }
    .bubble { flex: 1; min-width: 0; }
    .line { margin: 0; font: 500 19px/1.3 -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
      letter-spacing: -.01em; color: var(--ink); transition: opacity .2s ease, filter .2s ease; text-wrap: pretty; }
    .line.fade { opacity: 0; filter: blur(3px); }
    .who { margin-top: 2px; font-size: 12px; color: var(--ink-3); letter-spacing: .01em; }
    .clock { flex: none; font: 600 13px -apple-system, system-ui, sans-serif; font-variant-numeric: tabular-nums;
      color: var(--ink-2); background: var(--fill); border-radius: 999px; padding: 6px 10px; }
    .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--hair); }
    .progress i { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 2px;
      box-shadow: 0 0 10px var(--accent); transition: width .25s linear; }

    .section { padding: 10px 14px 4px; display: flex; flex-direction: column; gap: 10px; }
    .label { padding: 0 6px; font-size: 11.5px; font-weight: 600; color: var(--ink-3); }
    .tray { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 14px; background: var(--fill); }
    .glyph { flex: none; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
      background: linear-gradient(160deg, #5e9cff, #0a5cff); color: #fff; }
    .glyph svg { width: 18px; height: 18px; }
    .meta { flex: 1; min-width: 0; }
    .tray .name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tray .site { font-size: 12px; color: var(--ink-2); }
    .tray .big { font: 600 17px -apple-system, system-ui, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; }

    .reply { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
    .reply:empty { display: none; }
    .row { display: flex; gap: 8px; }
    input[type=text], input[type=number] { flex: 1; min-width: 0; height: 44px; border-radius: 12px; border: 0;
      background: var(--fill); color: var(--ink); padding: 0 14px; font: inherit; outline: none; }
    input::placeholder { color: var(--ink-3); }
    input:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 40%, transparent); }
    button { height: 44px; border-radius: 12px; border: 0; padding: 0 18px; cursor: pointer;
      font: 600 14px -apple-system, system-ui, sans-serif; background: var(--fill); color: var(--ink);
      transition: transform .12s ease, background .2s ease; }
    button:hover { background: var(--fill-strong); }
    button:active { transform: scale(.97); }
    button:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent); }
    button.primary { background: var(--accent); color: var(--accent-ink); }
    button.primary:hover { background: color-mix(in srgb, var(--accent) 88%, #000); }
    button.grow { flex: 1; }
    .scale { display: flex; align-items: center; gap: 12px; padding: 4px 6px; font-size: 12px; color: var(--ink-3); }
    input[type=range] { flex: 1; -webkit-appearance: none; appearance: none; height: 28px; background: transparent; outline: none; --p: 44.4%; }
    input[type=range]::-webkit-slider-runnable-track { height: 6px; border-radius: 3px;
      background: linear-gradient(to right, var(--accent) var(--p), var(--fill-strong) var(--p)); }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; margin-top: -10px;
      border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.22), 0 0 0 .5px rgba(0,0,0,.08); }
    input[type=range]:focus-visible::-webkit-slider-thumb { box-shadow: 0 2px 6px rgba(0,0,0,.22), 0 0 0 4px color-mix(in srgb, var(--accent) 40%, transparent); }
    .scale output { font: 600 20px -apple-system, system-ui, sans-serif; color: var(--ink); width: 28px; text-align: right;
      font-variant-numeric: tabular-nums; }

    .foot { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px 14px;
      font-size: 11.5px; color: var(--ink-3); }
    .escape { background: none; height: auto; padding: 0; font-weight: 500; font-size: 11.5px; color: var(--ink-3); }
    .escape:hover { background: none; color: var(--ink-2); }

    #penguin { width: 48px; height: 57px; margin-top: 10px; overflow: visible; }
    #penguin .all { transform-origin: 60px 130px; transition: transform .5s ease; }
    #penguin .brow { transition: transform .35s ease; transform-box: fill-box; transform-origin: center; }
    #penguin .mono { transition: transform .5s ease; transform-origin: 72px 50px; }
    #penguin .flip { transition: transform .45s ease; transform-origin: 22px 80px; }
    .composed .all { animation: bob 2.4s ease-in-out infinite; }
    @keyframes bob { 50% { transform: translateY(-3px) } }
    .raised_eyebrow .brow-r { transform: translateY(-5px) rotate(-8deg); }
    .pained .brow-l { transform: rotate(14deg) translateY(1px); }
    .pained .brow-r { transform: rotate(-14deg) translateY(1px); }
    .pained .flip { transform: rotate(118deg); }
    .despair .all { transform: rotate(-9deg) translateY(6px); }
    .despair .mono { transform: translate(4px, 26px) rotate(30deg); }
    .despair .brow-l { transform: rotate(18deg) translateY(2px); }
    .despair .brow-r { transform: rotate(-18deg) translateY(2px); }
    .approving .all { animation: bow 1.4s ease-in-out 2; }
    @keyframes bow { 40% { transform: rotate(14deg) } 80% { transform: rotate(0) } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
  `;

  const PENGUIN = `
    <svg id="penguin" class="composed" viewBox="8 18 104 124" role="img" aria-label="Penglu the penguin butler">
      <g class="all">
        <ellipse cx="44" cy="134" rx="13" ry="5" fill="#d9a441"/><ellipse cx="76" cy="134" rx="13" ry="5" fill="#d9a441"/>
        <g class="flip"><ellipse cx="18" cy="96" rx="9" ry="24" fill="#1d2230" transform="rotate(14 18 96)"/><circle cx="13" cy="117" r="6" fill="#fff" stroke="#d9d2c1"/></g>
        <g><ellipse cx="102" cy="96" rx="9" ry="24" fill="#1d2230" transform="rotate(-14 102 96)"/><circle cx="107" cy="117" r="6" fill="#fff" stroke="#d9d2c1"/></g>
        <ellipse cx="60" cy="82" rx="44" ry="54" fill="#1d2230"/>
        <ellipse cx="60" cy="96" rx="30" ry="38" fill="#f3ead8"/>
        <ellipse cx="60" cy="50" rx="27" ry="21" fill="#f3ead8"/>
        <circle cx="49" cy="49" r="4" fill="#1d2230"/><circle cx="71" cy="49" r="4" fill="#1d2230"/>
        <circle cx="50.3" cy="47.6" r="1.2" fill="#fff"/><circle cx="72.3" cy="47.6" r="1.2" fill="#fff"/>
        <rect class="brow brow-l" x="42" y="38" width="13" height="3" rx="1.5" fill="#1d2230"/>
        <rect class="brow brow-r" x="65" y="38" width="13" height="3" rx="1.5" fill="#1d2230"/>
        <path d="M54 57 L66 57 L60 66 Z" fill="#e0a33a"/>
        <g class="mono"><circle cx="71" cy="49" r="8.5" fill="#fff" fill-opacity=".25" stroke="#c9962b" stroke-width="2"/><path d="M79 52 Q86 66 80 80" fill="none" stroke="#c9962b" stroke-width="1.2"/></g>
        <path d="M60 76 L47 69 L47 83 Z M60 76 L73 69 L73 83 Z" fill="#1f3a8a"/><circle cx="60" cy="76" r="3.4" fill="#2c4fb3"/>
      </g>
    </svg>`;

  const BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 9.5h15l-1.3 9.4a2 2 0 0 1-2 1.6H7.8a2 2 0 0 1-2-1.6z"/><path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/></svg>';
  const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';

  const HTML = `
    <div class="backdrop"></div>
    <section class="panel" role="dialog" aria-label="Penglu is holding this purchase">
      <div class="field">
        <div class="avatar">${PENGUIN}</div>
        <div class="bubble" aria-live="polite"><p class="line">Ahem.</p><div class="who">Penglu is holding this purchase</div></div>
        <span class="clock">2:00</span>
        <div class="progress"><i></i></div>
      </div>
      <div class="section">
        <div class="tray"><span class="glyph">${BAG}</span><div class="meta"><div class="name"></div><div class="site"></div></div><div class="big"></div></div>
        <div class="reply"></div>
      </div>
      <div class="foot"><span>Your order hasn't been placed</span><button class="escape" type="button">Emergency: let me through</button></div>
    </section>`;

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function storageGet(key) {
    return new Promise(resolve => {
      try { chrome.storage.local.get(key, v => resolve(v && v[key])); } catch (_) { resolve(undefined); }
    });
  }
  function storageSet(obj) {
    try { chrome.storage.local.set(obj); } catch (_) { /* storage is optional */ }
  }

  function show(attempt, onDecision) {
    if (open) return;
    open = true;

    const S = P.script;
    const product = attempt.product || {};
    const priceText = P.price.formatPrice(product.price) || 'this';
    const ctx = { name: shortName(product.name), price: priceText };

    const host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>${CSS}</style>${HTML}`;
    // Keys typed into Penglu's inputs shouldn't trigger the shop's shortcuts.
    ['keydown', 'keyup', 'keypress'].forEach(t => host.addEventListener(t, e => e.stopPropagation()));
    document.documentElement.appendChild(host);

    const $ = sel => shadow.querySelector(sel);
    const penguin = $('#penguin'), lineEl = $('.line'), reply = $('.reply');
    tray(product.name || 'This purchase', product.site || location.hostname, priceText === 'this' ? '' : priceText);

    let done = false, begIndex = 0;
    const started = Date.now();
    const timer = setInterval(tick, 250);
    tick();

    $('.escape').addEventListener('click', () => finish('release', 'bought'));

    run();

    // ---- the scene ----
    async function run() {
      say(S.line('arrive', ctx, Math.floor(Math.random() * S.LINES.arrive.length)));
      await wait(3000);

      for (const q of S.QUESTIONS) {
        if (timeUp()) break;
        say(S.questionLine(q, ctx));
        const answer = await ask(q);
        if (done || answer === undefined) return;
        if (answer === null) break; // the clock ran out
        const r = S.reaction(q.id, answer, ctx);
        if (r) { say(r); await wait(2600); }
      }

      if (!timeUp() && product.price && product.price.currency === 'INR') {
        let rate = await storageGet('hourlyRate');
        if (!(rate > 0)) {
          say(S.line('askRate', ctx));
          rate = await askRate();
          if (done) return;
          if (rate > 0) storageSet({ hourlyRate: rate });
        }
        clearReply();
        const hours = S.workHours(product.price.amount, rate);
        if (hours) {
          say(S.line('cost', { ...ctx, hours }));
          tray('Cost in your working hours', `at ₹${Number(rate).toLocaleString('en-IN')} an hour`, `${hours} hrs`, 'clock');
          await wait(5000);
        }
      }

      clearReply();
      while (!timeUp() && !done) {
        say(S.line('beg', ctx, begIndex++));
        await waitUntilOr(6500);
      }
      if (done) return;

      tray(product.name || 'This purchase', product.site || location.hostname, priceText === 'this' ? '' : priceText);
      say(S.line('decide', ctx));
      setReply(`<div class="row">
        <button class="primary grow" type="button" data-d="skip">I'll skip it</button>
        <button class="grow" type="button" data-d="need">I really need it</button></div>`);
      reply.querySelector('[data-d=skip]').focus();
      reply.querySelector('[data-d=skip]').addEventListener('click', () => finish('cancel', 'skipped'));
      reply.querySelector('[data-d=need]').addEventListener('click', () => finish('release', 'bought'));
    }

    // ---- inputs ----
    function ask(q) {
      return new Promise(resolve => {
        if (q.kind === 'text') {
          setReply(`<form class="row"><input type="text" maxlength="120" required>
            <button class="primary" type="submit">Answer</button></form>`);
          const input = reply.querySelector('input');
          input.placeholder = q.placeholder || '';
          input.focus();
          reply.querySelector('form').addEventListener('submit', e => {
            e.preventDefault(); e.stopPropagation();
            resolve(input.value.trim());
          });
        } else if (q.kind === 'scale') {
          setReply(`<div class="scale"><span>1</span><input type="range" min="1" max="10" value="5"><span>10</span>
            <output>5</output></div><div class="row"><button class="primary grow" type="button">That's my answer</button></div>`);
          const range = reply.querySelector('input'), out = reply.querySelector('output');
          const paint = () => { out.textContent = range.value; range.style.setProperty('--p', ((range.value - 1) / 9 * 100) + '%'); };
          range.addEventListener('input', paint);
          paint();
          range.focus();
          reply.querySelector('button').addEventListener('click', () => resolve(Number(range.value)));
        } else {
          setReply(`<div class="row">${q.options.map((o, i) =>
            `<button class="grow" type="button" data-i="${i}"></button>`).join('')}</div>`);
          reply.querySelectorAll('button').forEach(b => {
            b.textContent = q.options[Number(b.dataset.i)];
            b.addEventListener('click', () => resolve(q.options[Number(b.dataset.i)]));
          });
        }
        // If the clock runs out mid-question, move on to the decision.
        const watch = setInterval(() => {
          if (done || timeUp()) { clearInterval(watch); resolve(done ? undefined : null); }
        }, 500);
      });
    }

    function askRate() {
      return new Promise(resolve => {
        setReply(`<form class="row"><input type="number" min="1" step="1" placeholder="₹ per hour" required>
          <button class="primary" type="submit">Save</button></form>`);
        const input = reply.querySelector('input');
        input.focus();
        reply.querySelector('form').addEventListener('submit', e => {
          e.preventDefault(); e.stopPropagation();
          resolve(Number(input.value));
        });
        const watch = setInterval(() => {
          if (done || timeUp()) { clearInterval(watch); resolve(null); }
        }, 500);
      });
    }

    // ---- helpers ----
    function say({ text, mood }) {
      lineEl.classList.add('fade');
      setTimeout(() => { lineEl.textContent = text; lineEl.classList.remove('fade'); }, 200);
      penguin.setAttribute('class', mood || 'composed');
    }
    function tray(name, site, big, glyph) {
      $('.glyph').innerHTML = glyph === 'clock' ? CLOCK : BAG;
      $('.tray .name').textContent = name;
      $('.tray .site').textContent = site;
      $('.tray .big').textContent = big;
    }
    function setReply(html) { reply.innerHTML = html; }
    function clearReply() { reply.innerHTML = ''; }
    function elapsed() { return (Date.now() - started) / 1000; }
    function timeUp() { return elapsed() >= S.HOLD_SECONDS; }
    async function waitUntilOr(ms) {
      const end = Date.now() + ms;
      while (Date.now() < end && !timeUp() && !done) await wait(250);
    }
    function tick() {
      const left = Math.max(0, Math.ceil(S.HOLD_SECONDS - elapsed()));
      $('.clock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      $('.progress i').style.width = (100 * Math.min(1, elapsed() / S.HOLD_SECONDS)).toFixed(1) + '%';
    }

    async function finish(decision, lineKey) {
      if (done) return;
      done = true;
      clearInterval(timer);
      clearReply();
      say(S.line(lineKey, ctx, Math.floor(Math.random() * 2)));
      await wait(2200);
      host.remove();
      open = false;
      onDecision(decision);
    }
  }

  function shortName(name) {
    const n = String(name || '').split(/\s[|:–—-]\s/)[0].trim();
    if (!n) return 'this';
    return n.length > 40 ? n.slice(0, 38).trim() + '…' : n;
  }

  P.overlay = { show };
})(globalThis);
