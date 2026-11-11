/* Joined Servers Search 7.1.0 — UI. Keep the working v7 page bridge unchanged. */
(() => {
  'use strict';
  if (window.__discordServerNamesUiV7) return;
  window.__discordServerNamesUiV7 = true;

  const ROOT_ID = 'dsn-v7-root';
  const DATA = 'discord-server-names-v7:data';
  const REQUEST = 'discord-server-names-v7:request';
  const isId = id => /^\d{15,22}$/.test(String(id || ''));
  const text = value => String(value || '').replace(/\s+/g, ' ').trim();
  const validName = value => typeof value === 'string' && value.length > 0 && value.length <= 120 && !/^\d+$/.test(value);
  const names = new Map();
  let order = [];
  let diagnostic = null;
  let pageBridgeSeen = false;
  let timer = null;
  let enabled = true;
  let showListByDefault = false;
  let query = '';
  let selected = 0;
  let lastRender = '';
  let locationState = { left: 76, top: 0 };
  let dragging = null;

  const create = (tag, className, content) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (content !== undefined) n.textContent = content;
    return n;
  };

  const root = create('aside', 'dsn-v7-root');
  root.id = ROOT_ID;
  root.setAttribute('aria-label', 'Joined Servers Search');

  // A compact, searchable bar replaces the old non-searchable minimized header.
  const bar = create('div', 'dsn-v7-bar');
  const grip = create('button', 'dsn-v7-grip', '⠿');
  grip.type = 'button';
  grip.title = 'Drag to move Joined Servers Search';
  grip.setAttribute('aria-label', 'Drag to move Joined Servers Search');
  const search = create('input', 'dsn-v7-search');
  search.type = 'search';
  search.placeholder = 'Search joined servers…';
  search.setAttribute('aria-label', 'Search joined Discord servers');
  search.autocomplete = 'off';
  search.spellcheck = false;
  const toggle = create('button', 'dsn-v7-icon-button dsn-v7-toggle', '▤');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Toggle full server list');
  bar.append(grip, search, toggle);

  const panel = create('div', 'dsn-v7-panel');
  const heading = create('header', 'dsn-v7-heading');
  const title = create('strong', 'dsn-v7-title', 'Joined Servers Search');
  const refresh = create('button', 'dsn-v7-icon-button', '↻');
  refresh.type = 'button';
  refresh.title = 'Retry name discovery';
  refresh.setAttribute('aria-label', 'Retry name discovery');
  heading.append(title, refresh);
  const count = create('div', 'dsn-v7-count', 'Discovering servers…');
  const detail = create('div', 'dsn-v7-detail', 'Waiting for Discord client data');
  const list = create('div', 'dsn-v7-list');
  list.setAttribute('role', 'list');
  const footer = create('div', 'dsn-v7-footer');
  const copy = create('button', 'dsn-v7-copy', 'Copy status');
  copy.type = 'button';
  footer.append(copy);
  panel.append(heading, count, detail, list, footer);
  root.append(bar, panel);

  const mounted = () => { if (document.body && !root.isConnected) document.body.append(root); };
  const visibleList = () => showListByDefault || query.trim().length > 0;
  const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(high, low));

  function applyPosition() {
    if (!root.isConnected) return;
    // Use measured size so the panel remains accessible after resizing or expanding.
    const maxLeft = Math.max(0, window.innerWidth - root.getBoundingClientRect().width - 4);
    const maxTop = Math.max(0, window.innerHeight - root.getBoundingClientRect().height - 4);
    root.style.left = `${Math.round(clamp(locationState.left, 0, maxLeft))}px`;
    root.style.top = `${Math.round(clamp(locationState.top, 0, maxTop))}px`;
  }
  function beginDrag(event) {
    if (event.button !== 0 || event.isPrimary === false || event.target.closest('.dsn-v7-icon-button')) return;
    const rect = root.getBoundingClientRect();
    dragging = {
      pointerId: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      captureTarget: event.currentTarget
    };
    root.classList.add('dsn-v7-dragging');
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) { /* unsupported */ }
    event.preventDefault();
  }
  function moveDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const maxLeft = Math.max(0, window.innerWidth - root.getBoundingClientRect().width - 4);
    const maxTop = Math.max(0, window.innerHeight - root.getBoundingClientRect().height - 4);
    locationState = {
      left: Math.round(clamp(event.clientX - dragging.dx, 0, maxLeft)),
      top: Math.round(clamp(event.clientY - dragging.dy, 0, maxTop))
    };
    if (Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 2) dragging.moved = true;
    applyPosition();
    event.preventDefault();
  }
  function endDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const changed = dragging.moved;
    try { dragging.captureTarget.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
    dragging = null;
    root.classList.remove('dsn-v7-dragging');
    if (changed) chrome.storage.local.set({ panelPosition: { ...locationState } });
  }
  grip.addEventListener('pointerdown', beginDrag);
  // The expanded list's title bar is draggable too (except its refresh button).
  heading.addEventListener('pointerdown', beginDrag);
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', applyPosition);

  function detectVisibleIds() {
    const ids = []; const seen = new Set();
    for (const node of document.querySelectorAll('[data-list-item-id^="guildsnav___"]')) {
      if (node.closest('#' + ROOT_ID)) continue;
      const id = node.getAttribute('data-list-item-id')?.match(/guildsnav___(\d{15,22})(?:_|$)/)?.[1];
      if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
    }
    return ids;
  }
  function serverList() {
    const combined = [...order, ...detectVisibleIds(), ...names.keys()];
    const found = []; const seen = new Set();
    for (const id of combined) {
      if (!isId(id) || seen.has(id)) continue;
      seen.add(id);
      found.push({ id, name: names.get(id) || '' });
    }
    return found;
  }
  function render() {
    mounted();
    root.classList.toggle('dsn-v7-disabled', !enabled);
    const listOpen = visibleList();
    root.classList.toggle('dsn-v7-list-open', listOpen);
    toggle.textContent = showListByDefault ? '▴' : '▤';
    toggle.title = showListByDefault ? 'Show only the search field by default' : 'Always show the full server list';
    toggle.setAttribute('aria-expanded', String(listOpen));
    if (!enabled) return;

    const all = serverList();
    const filter = query.toLocaleLowerCase().trim();
    const rows = filter ? all.filter(g => g.name.toLocaleLowerCase().includes(filter)) : all;
    if (selected >= rows.length) selected = Math.max(0, rows.length - 1);
    const countNamed = all.filter(g => g.name).length;
    const cacheCount = diagnostic?.modules || 0;
    const status = pageBridgeSeen ?
      diagnostic?.guildStore ? `GuildStore connected · ${cacheCount} modules` :
      diagnostic?.webpack ? `GuildStore unavailable · ${cacheCount} modules` :
      'Discord webpack runtime not found yet' : 'Page adapter not responding';
    const fingerprint = JSON.stringify([all, query, selected, status, enabled, listOpen]);
    if (fingerprint === lastRender) { applyPosition(); return; }
    lastRender = fingerprint;
    count.textContent = `${all.length} joined server${all.length === 1 ? '' : 's'} · ${countNamed} named · no channels`;
    detail.textContent = status;
    detail.title = diagnostic?.error || status;
    const frag = document.createDocumentFragment();
    if (!rows.length) frag.append(create('p', 'dsn-v7-empty', all.length ? 'No matching server names.' : 'Waiting for your server list…'));
    for (const [i, entry] of rows.entries()) {
      const link = create('a', 'dsn-v7-row' + (i === selected ? ' dsn-v7-selected' : ''));
      link.href = `/channels/${entry.id}`;
      link.title = entry.name || `Discord server ID ${entry.id}; name not yet available`;
      link.setAttribute('role', 'listitem');
      const symbol = create('span', 'dsn-v7-dot', '●');
      symbol.setAttribute('aria-hidden', 'true');
      const name = create('span', 'dsn-v7-name', entry.name || `Name unavailable (${entry.id})`);
      link.append(symbol, name);
      frag.append(link);
    }
    list.replaceChildren(frag);
    applyPosition();
  }
  function scheduleRender() { clearTimeout(timer); timer = setTimeout(render, 80); }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== DATA) return;
    pageBridgeSeen = true;
    const payload = event.data;
    if (Array.isArray(payload.names)) for (const item of payload.names) {
      if (item && isId(item.id) && validName(item.name)) names.set(item.id, text(item.name));
    }
    if (Array.isArray(payload.order)) order = payload.order.filter(isId);
    if (payload.diagnostic && typeof payload.diagnostic === 'object') {
      diagnostic = {
        webpack: payload.diagnostic.webpack === true,
        modules: Number(payload.diagnostic.modules) || 0,
        guildStore: payload.diagnostic.guildStore === true,
        scans: Number(payload.diagnostic.scans) || 0,
        error: text(payload.diagnostic.error).slice(0, 150)
      };
    }
    scheduleRender();
  });
  search.addEventListener('input', () => { query = search.value; selected = 0; lastRender = ''; render(); });
  search.addEventListener('keydown', event => {
    const rows = serverList().filter(g => g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!rows.length) return;
      selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      if (!query.trim() && !showListByDefault) { // Expose the selected result without changing the saved default.
        query = search.value = rows[selected].name;
        selected = 0;
      }
      lastRender = ''; render();
    } else if (event.key === 'Enter') {
      if (visibleList()) { event.preventDefault(); list.querySelector('.dsn-v7-selected')?.click(); }
    } else if (event.key === 'Escape') {
      query = ''; search.value = ''; selected = 0; lastRender = ''; render();
    }
  });
  toggle.addEventListener('click', () => {
    showListByDefault = !showListByDefault;
    chrome.storage.local.set({ showListByDefault });
    lastRender = ''; render();
    search.focus();
  });
  refresh.addEventListener('click', () => {
    window.postMessage({ source: REQUEST }, location.origin);
    detail.textContent = 'Retrying name discovery…';
  });
  copy.addEventListener('click', () => {
    const all = serverList();
    const report = `Joined Servers Search 7.1.0\nJoined servers: ${all.length}\nNamed: ${all.filter(x => x.name).length}\nPage adapter: ${pageBridgeSeen ? 'connected' : 'not responding'}\nWebpack: ${diagnostic?.webpack ? 'found' : 'not detected'}\nModules: ${diagnostic?.modules ?? 'unknown'}\nGuildStore: ${diagnostic?.guildStore ? 'found' : 'not found'}\nScans: ${diagnostic?.scans ?? 0}\nError: ${diagnostic?.error || 'none'}`;
    navigator.clipboard?.writeText(report).then(() => { copy.textContent = 'Copied!'; setTimeout(() => copy.textContent = 'Copy status', 1700); })
      .catch(() => { copy.textContent = 'Copy failed'; });
  });

  // Upgrade the old preference in-place: a user who manually expanded v7 is
  // not forced into full-list mode, since the new default is search-only.
  chrome.storage.local.get({ enabled: true, showListByDefault: false, panelPosition: null }, prefs => {
    enabled = prefs.enabled !== false;
    showListByDefault = prefs.showListByDefault === true;
    const saved = prefs.panelPosition;
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      locationState = { left: saved.left, top: saved.top };
    } else {
      locationState = { left: 76, top: showListByDefault ? 75 : 0 };
    }
    lastRender = ''; render();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) enabled = changes.enabled.newValue !== false;
    if (changes.showListByDefault) showListByDefault = changes.showListByDefault.newValue === true;
    if (changes.panelPosition && !dragging) {
      const pos = changes.panelPosition.newValue;
      if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) locationState = { left: pos.left, top: pos.top };
      else locationState = { left: 76, top: showListByDefault ? 75 : 0 };
    }
    lastRender = ''; render();
  });
  new MutationObserver(records => {
    if (records.every(r => r.target.closest?.('#' + ROOT_ID))) return;
    scheduleRender();
  }).observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener('popstate', scheduleRender);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { scheduleRender(); window.postMessage({ source: REQUEST }, location.origin); }
  });
  render();
  window.postMessage({ source: REQUEST }, location.origin);
})();
