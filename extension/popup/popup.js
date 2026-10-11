// Penglu popup: the Book of Restraint and settings.
(function () {
  'use strict';

  const P = globalThis.Penglu;
  const L = P.ledger, S = P.settings;
  const $ = id => document.getElementById(id);
  const BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 9.5h15l-1.3 9.4a2 2 0 0 1-2 1.6H7.8a2 2 0 0 1-2-1.6z"/><path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/></svg>';

  const state = { ledger: [], settings: S.withDefaults(), month: L.monthKey(Date.now()), tab: 'skipped', host: null };

  // ---------- data ----------
  async function load() {
    const v = await chrome.storage.local.get(['ledger', 'settings']);
    state.ledger = v.ledger || [];
    state.settings = S.withDefaults(v.settings);
  }
  function saveSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    return chrome.storage.local.set({ settings: state.settings });
  }

  // ---------- formatting ----------
  const money = map => {
    const parts = Object.entries(map || {}).sort((a, b) => (a[0] === 'INR' ? -1 : b[0] === 'INR' ? 1 : 0))
      .map(([currency, amount]) => P.price.formatPrice({ amount: Math.round(amount * 100) / 100, currency }));
    return parts.length ? parts.join(' + ') : '₹0';
  };
  const when = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---------- ledger view ----------
  function months() {
    const set = new Set([L.monthKey(Date.now()), ...L.months(state.ledger)]);
    return [...set].sort();
  }

  function renderLedger() {
    const all = months();
    const i = all.indexOf(state.month);
    $('prev').disabled = i <= 0;
    $('next').disabled = i >= all.length - 1;

    const s = L.summarize(state.ledger, state.month);
    $('month-label').textContent = s.label;
    $('saved').textContent = money(s.saved);
    const spent = Object.keys(s.spent).length ? ` · ${money(s.spent)} let through` : '';
    $('sub').textContent = s.attempts
      ? `${plural(s.skipped.length, 'temptation', 'temptations')} declined${spent}`
      : 'Nothing declined yet';

    $('tab-skipped').setAttribute('aria-selected', state.tab === 'skipped');
    $('tab-let').setAttribute('aria-selected', state.tab === 'let');
    $('tab-skipped').textContent = `Skipped · ${s.skipped.length}`;
    $('tab-let').textContent = `Let through · ${s.letThrough.length}`;

    const items = state.tab === 'skipped' ? s.skipped : s.letThrough;
    const list = $('list');
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const b = document.createElement('b');
      b.textContent = state.tab === 'skipped' ? 'Nothing skipped yet' : 'Nothing let through';
      empty.append(b, state.tab === 'skipped'
        ? 'When Penglu talks you out of a purchase, it appears here with its link.'
        : 'Purchases you chose to go ahead with appear here.');
      list.append(empty);
      return;
    }
    for (const e of items) list.append(row(e, state.tab === 'skipped'));
  }

  function row(e, saved) {
    const el = document.createElement(e.url ? 'a' : 'div');
    el.className = 'item';
    if (e.url) { el.href = e.url; el.target = '_blank'; el.rel = 'noopener'; el.title = e.url; }

    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    if (e.image) {
      const img = document.createElement('img');
      img.src = e.image; img.alt = ''; img.referrerPolicy = 'no-referrer';
      img.onerror = () => { thumb.innerHTML = BAG; };
      thumb.append(img);
    } else thumb.innerHTML = BAG;

    const info = document.createElement('span');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name'; name.textContent = e.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = [e.site, when(e.at), e.importance ? `${e.importance}/10` : null].filter(Boolean).join(' · ');
    info.append(name, meta);

    const price = document.createElement('span');
    price.className = 'price' + (saved ? ' saved' : '');
    price.textContent = e.price ? P.price.formatPrice(e.price) : '—';

    el.append(thumb, info, price);
    return el;
  }

  // ---------- settings view ----------
  function renderSettings() {
    const s = state.settings;
    if (document.activeElement !== $('rate')) $('rate').value = s.hourlyRate || '';
    if (document.activeElement !== $('threshold')) $('threshold').value = s.threshold;
    $('wake').disabled = !(s.snoozeUntil > Date.now());

    const chips = $('chips');
    chips.replaceChildren();
    for (const site of s.allowlist) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.append(site);
      const x = document.createElement('button');
      x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', `Remove ${site}`);
      x.addEventListener('click', () => saveSettings({ allowlist: s.allowlist.filter(a => a !== site) }));
      chip.append(x);
      chips.append(chip);
    }

    const host = state.host;
    const allowed = host && s.allowlist.some(a => S.siteMatches(host, a));
    $('this-site').textContent = host ? host : 'Open a shop to allow it';
    $('allow-site').disabled = !host || allowed;
    $('allow-site').textContent = allowed ? 'Allowed' : 'Allow';
  }

  function renderStatus() {
    const until = state.settings.snoozeUntil;
    const st = $('status');
    if (until > Date.now()) {
      st.textContent = `Snoozed until ${new Date(until).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
      st.classList.add('snoozed');
    } else {
      st.textContent = 'Watching for purchases';
      st.classList.remove('snoozed');
    }
  }

  function render() { renderStatus(); renderLedger(); renderSettings(); }

  // ---------- events ----------
  $('prev').addEventListener('click', () => { const m = months(); state.month = m[Math.max(0, m.indexOf(state.month) - 1)]; renderLedger(); });
  $('next').addEventListener('click', () => { const m = months(); state.month = m[Math.min(m.length - 1, m.indexOf(state.month) + 1)]; renderLedger(); });
  $('tab-skipped').addEventListener('click', () => { state.tab = 'skipped'; renderLedger(); });
  $('tab-let').addEventListener('click', () => { state.tab = 'let'; renderLedger(); });

  $('toggle-settings').addEventListener('click', () => {
    const open = $('settings-view').hidden;
    $('settings-view').hidden = !open;
    $('ledger-view').hidden = open;
    $('toggle-settings').setAttribute('aria-pressed', open);
  });

  $('rate').addEventListener('change', e => saveSettings({ hourlyRate: Number(e.target.value) > 0 ? Number(e.target.value) : null }));
  $('threshold').addEventListener('change', e => saveSettings({ threshold: Math.max(0, Number(e.target.value) || 0) }));

  document.querySelectorAll('[data-snooze]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.snooze;
    let until = 0;
    if (v === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); until = d.getTime(); }
    else if (Number(v) > 0) until = Date.now() + Number(v) * 60 * 1000;
    saveSettings({ snoozeUntil: until });
  }));

  $('allow-site').addEventListener('click', () => {
    if (state.host) saveSettings({ allowlist: [...state.settings.allowlist, state.host] });
  });

  chrome.storage.onChanged.addListener(async () => { await load(); render(); });

  // ---------- start ----------
  (async () => {
    await load();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const u = tab && tab.url && new URL(tab.url);
      if (u && /^https?:$/.test(u.protocol)) state.host = S.normalizeHost(u.hostname);
    } catch (_) { /* no tab access is fine */ }
    render();
  })();
})();
