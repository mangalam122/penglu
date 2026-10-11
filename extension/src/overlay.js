// Penglu's popup. Lives in a closed Shadow DOM so the shop's CSS can't touch
// Penglu and Penglu's CSS can't break the shop. Dims the page, holds the
// purchase for HOLD_SECONDS, walks through the script, then hands back a
// decision: 'cancel' (skipped) or 'release' (the user's next click goes through).
(function (root) {
  'use strict';

  const P = root.Penglu = root.Penglu || {};
  let open = false;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; background: rgba(14, 19, 34, .62);
      display: grid; place-items: center; animation: fade .4s ease both; }
    .held { font: italic 600 22px Georgia, 'Times New Roman', serif; color: #f3ead8; opacity: .9; }
    .panel { position: fixed; right: 24px; bottom: 24px; width: 340px; max-width: calc(100vw - 32px);
      background: #fbf8f1; color: #1b2030; border-radius: 18px; padding: 14px 16px 12px;
      box-shadow: 0 24px 60px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 12px;
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      animation: waddle .7s cubic-bezier(.2,.9,.25,1.15) both; }
    @keyframes fade { from { opacity: 0 } }
    @keyframes waddle { from { transform: translateX(420px) } }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .who { font-weight: 700; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #1f2a48; }
    .who em { font: italic 600 15px Georgia, serif; text-transform: none; letter-spacing: 0; color: #8a6a1e; margin-left: 4px; }
    .ring { position: relative; width: 46px; height: 46px; }
    .ring svg { width: 46px; height: 46px; transform: rotate(-90deg); }
    .ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11px; color: #1f2a48;
      font-variant-numeric: tabular-nums; }
    .scene { display: grid; grid-template-columns: 92px 1fr; gap: 10px; align-items: end; }
    .bubble { background: #fff; border: 1px solid #e6dfcf; border-radius: 14px 14px 14px 4px; padding: 10px 12px;
      min-height: 96px; display: flex; align-items: center; }
    .bubble p { margin: 0; font: italic 500 17px/1.3 Georgia, 'Times New Roman', serif; color: #1b2030; transition: opacity .2s; }
    .bubble p.fade { opacity: 0; }
    .tray { border-radius: 12px; background: #1f2a48; color: #f3ead8; padding: 10px 12px; display: flex;
      justify-content: space-between; align-items: center; gap: 10px; }
    .tray .name { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .tray .site { color: #b9c1d8; font-size: 11.5px; }
    .tray .big { font-weight: 700; font-size: 18px; color: #f2c35a; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .reply { min-height: 42px; display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; gap: 8px; }
    input[type=text], input[type=number] { flex: 1; min-width: 0; height: 40px; border-radius: 10px; border: 1px solid #d9d2c1;
      background: #fff; color: #1b2030; padding: 0 12px; font: inherit; }
    input:focus-visible, button:focus-visible { outline: 3px solid #c9962b; outline-offset: 1px; }
    input[type=range] { flex: 1; accent-color: #1f2a48; }
    .scale { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #5b6275; }
    .scale output { font-weight: 700; font-size: 16px; color: #1f2a48; width: 24px; text-align: right; }
    button { height: 40px; border-radius: 10px; border: 0; padding: 0 14px; font: 700 13px/1 inherit; font-family: inherit;
      cursor: pointer; background: #ece6d8; color: #1f2a48; }
    button.primary { background: #1f2a48; color: #f3ead8; }
    button.grow { flex: 1; }
    .foot { display: flex; justify-content: flex-end; }
    .escape { background: none; height: auto; padding: 2px 0; font-weight: 500; font-size: 11px; color: #9a9384;
      text-decoration: underline; }
    #penguin { width: 92px; height: 108px; overflow: visible; }
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
    <svg id="penguin" class="composed" viewBox="0 0 120 140" role="img" aria-label="Penglu the penguin butler">
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

  const HTML = `
    <div class="backdrop"><span class="held">Held by Penglu</span></div>
    <section class="panel" role="dialog" aria-label="Penglu is holding this purchase">
      <div class="top">
        <div class="who">Penglu <em>at your service</em></div>
        <div class="ring"><svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" fill="none" stroke="#e6dfcf" stroke-width="4"/>
          <circle class="arc" cx="23" cy="23" r="19" fill="none" stroke="#c9962b" stroke-width="4" stroke-linecap="round"
            stroke-dasharray="119.4" stroke-dashoffset="0"/></svg><b class="clock">2:00</b></div>
      </div>
      <div class="scene">${PENGUIN}<div class="bubble" aria-live="polite"><p class="line">Ahem.</p></div></div>
      <div class="tray"><div><div class="name"></div><div class="site"></div></div><div class="big"></div></div>
      <div class="reply"></div>
      <div class="foot"><button class="escape" type="button">Emergency: let me through</button></div>
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
          tray('Cost in your working hours', `at ₹${Number(rate).toLocaleString('en-IN')} an hour`, `${hours} hrs`);
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
          range.addEventListener('input', () => { out.textContent = range.value; });
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
    function tray(name, site, big) {
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
      $('.arc').setAttribute('stroke-dashoffset', (119.4 * Math.min(1, elapsed() / S.HOLD_SECONDS)).toFixed(1));
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
