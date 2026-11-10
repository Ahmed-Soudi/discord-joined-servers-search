/* Discord Joined Servers Search v7.0.1 — read-only page-world adapter. */
(() => {
  'use strict';
  if (window.__discordServerNamesBridgeV7) return;
  window.__discordServerNamesBridgeV7 = true;

  const SNOWFLAKE = /^\d{15,22}$/;
  const MESSAGE = 'discord-server-names-v7:data';
  const REQUEST = 'discord-server-names-v7:request';
  const known = new Map();
  let runtime = null;
  let guildStore = null;
  let scheduled = false;
  let scans = 0;
  let lastCacheSize = 0;
  let lookupMethod = 'none';
  let lastError = '';
  let reactCount = 0;
  let storeCount = 0;

  const validId = id => SNOWFLAKE.test(String(id || ''));
  const asName = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  function remember(id, name, source) {
    id = String(id || '');
    name = asName(name);
    if (!validId(id) || !name || name.length > 120) return false;
    if (!known.has(id) || known.get(id).name !== name || source === 'GuildStore') {
      known.set(id, { name, source });
    }
    if (source === 'GuildStore') storeCount++;
    else reactCount++;
    return true;
  }
  function guildObject(value, fallbackId, source) {
    if (!value || typeof value !== 'object') return;
    const id = value.id || fallbackId;
    // Explicit ID match avoids accidentally treating a server description as a title.
    if (!validId(id) || (value.id != null && String(value.id) !== String(id))) return;
    remember(id, value.name, source);
  }
  function consume(value, source) {
    if (!value || typeof value !== 'object') return;
    if (value instanceof Map) {
      for (const [id, guild] of value.entries()) guildObject(guild, id, source);
      return;
    }
    if (Array.isArray(value)) {
      for (const guild of value) guildObject(guild, null, source);
      return;
    }
    for (const [id, guild] of Object.entries(value)) guildObject(guild, id, source);
  }
  function getIconIds() {
    const ids = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('[data-list-item-id^="guildsnav___"]')) {
      const id = el.getAttribute('data-list-item-id')?.match(/guildsnav___(\d{15,22})(?:_|$)/)?.[1];
      if (id && !seen.has(id)) { ids.push(id); seen.add(id); }
    }
    return ids;
  }

  function captureRuntime() {
    if (runtime?.c) return runtime;
    // Vencord/Discord research identifies this as Discord's current chunk global.
    const chunk = window.webpackChunkdiscord_app;
    if (!chunk || typeof chunk.push !== 'function') return null;
    const probe = Symbol('server-names-readonly');
    let candidate = null;
    try {
      chunk.push([[probe], {}, requireFn => { candidate = requireFn; }]);
      // Remove only our own temporary chunk; never remove an app chunk.
      if (chunk[chunk.length - 1]?.[0]?.[0] === probe) chunk.pop();
      if (candidate?.c && typeof candidate.c === 'object') runtime = candidate;
    } catch (error) { lastError = `Runtime lookup: ${String(error).slice(0, 120)}`; }
    return runtime;
  }

  // Rspack exports are wrapped under build-specific names (Z, ZP, default, etc.).
  // Iterate the immediate named exports, then a shallow second level of wrappers.
  function* exportsOf(root) {
    if (!root || (typeof root !== 'object' && typeof root !== 'function')) return;
    const queue = [{value:root,depth:0}];
    const visited = new Set();
    while (queue.length) {
      const {value,depth} = queue.shift();
      if (!value || (typeof value !== 'object' && typeof value !== 'function') || visited.has(value)) continue;
      visited.add(value);
      yield value;
      if (depth >= 2 || visited.size >= 140) continue;
      try {
        // Only enumerate public exports and common wrappers. Do not walk into
        // unrelated application state, tokens, messages, or private data.
        for (const key of Object.keys(value).slice(0, 100)) {
          if (depth === 1 && !['default', 'Z', 'ZP', 'GuildStore', 'guildStore'].includes(key)) continue;
          let child;
          try { child = value[key]; } catch (_) { continue; }
          if (child && (typeof child === 'object' || typeof child === 'function')) {
            queue.push({value:child,depth:depth+1});
          }
        }
      } catch (_) { /* an export getter might throw */ }
    }
  }

  function looksLikeGuildStore(obj) {
    try {
      if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return false;
      const count = ['getGuilds','getGuildsArray','getGuildIds','getGuild'].filter(k => typeof obj[k] === 'function').length;
      return count >= 2 || (count === 1 && (typeof obj.getGuilds === 'function' || typeof obj.getGuildsArray === 'function'));
    } catch (_) { return false; }
  }
  function readStore(store) {
    if (!looksLikeGuildStore(store)) return 0;
    const before = known.size;
    try { if (typeof store.getGuilds === 'function') consume(store.getGuilds(), 'GuildStore'); }
    catch (e) { lastError = `getGuilds: ${String(e).slice(0, 100)}`; }
    try { if (typeof store.getGuildsArray === 'function') consume(store.getGuildsArray(), 'GuildStore'); }
    catch (_) {}
    try {
      const ids = typeof store.getGuildIds === 'function' ? store.getGuildIds() : getIconIds();
      if (Array.isArray(ids) && typeof store.getGuild === 'function') {
        for (const id of ids.slice(0, 250)) {
          if (!validId(id)) continue;
          try { guildObject(store.getGuild(id), id, 'GuildStore'); } catch (_) {}
        }
      }
    } catch (_) {}
    if (typeof store.getGuild === 'function') {
      for (const id of getIconIds()) {
        if (known.get(id)?.source === 'GuildStore') continue;
        try { guildObject(store.getGuild(id), id, 'GuildStore'); } catch (_) {}
      }
    }
    return known.size - before;
  }
  function findStore() {
    const req = captureRuntime();
    if (!req?.c) return false;
    lastCacheSize = Object.keys(req.c).length;
    if (guildStore) { readStore(guildStore); return true; }
    for (const module of Object.values(req.c)) {
      if (!module?.exports) continue;
      for (const candidate of exportsOf(module.exports)) {
        if (!looksLikeGuildStore(candidate)) continue;
        const n = readStore(candidate);
        if (n > 0 || known.size > 0 && typeof candidate.getGuild === 'function') {
          guildStore = candidate;
          lookupMethod = 'GuildStore';
          return true;
        }
      }
    }
    return false;
  }

  // Automatic fallback: Discord has already given each guild tile a React
  // component. Extract ONLY a guild object whose ID equals that tile's ID.
  // No interaction, hovering, inspecting, clicking, or changing Discord state.
  function reactNames() {
    const icons = document.querySelectorAll('[data-list-item-id^="guildsnav___"]');
    for (const icon of icons) {
      const id = icon.getAttribute('data-list-item-id')?.match(/guildsnav___(\d{15,22})(?:_|$)/)?.[1];
      if (!id || known.has(id)) continue;
      const targets = [icon, ...icon.querySelectorAll('a,button,[role="button"],img')].slice(0, 10);
      outer: for (const el of targets) {
        const keys = Object.keys(el);
        const reactPropKey = keys.find(k => k.startsWith('__reactProps$'));
        const fiberKey = keys.find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        const propsSets = [];
        if (reactPropKey) propsSets.push(el[reactPropKey]);
        let fiber = fiberKey ? el[fiberKey] : null;
        for (let n = 0; fiber && n < 32; n++, fiber = fiber.return) {
          propsSets.push(fiber.memoizedProps, fiber.pendingProps);
        }
        for (const props of propsSets) {
          const queue = [{obj:props,depth:0}];
          const visited = new Set();
          while (queue.length && visited.size < 80) {
            const {obj,depth} = queue.shift();
            if (!obj || typeof obj !== 'object' || visited.has(obj)) continue;
            visited.add(obj);
            if (String(obj.id || '') === id && typeof obj.name === 'string') remember(id, obj.name, 'React');
            if (obj.guild && String(obj.guild.id || '') === id) guildObject(obj.guild, id, 'React');
            if (known.has(id)) break outer;
            if (depth >= 3) continue;
            for (const key of ['guild', 'guildData', 'server', 'item', 'data', 'props', 'value', 'children']) {
              let value;
              try { value = obj[key]; } catch (_) { continue; }
              if (Array.isArray(value)) for (const sub of value.slice(0, 8)) queue.push({obj:sub,depth:depth+1});
              else if (value && typeof value === 'object') queue.push({obj:value,depth:depth+1});
            }
          }
        }
      }
    }
  }
  function emit() {
    const detectedIds = getIconIds();
    const details = {
      source: MESSAGE,
      names: [...known.entries()].map(([id, x]) => ({id,name:x.name})),
      order: detectedIds,
      diagnostic: {
        adapter: true,
        webpack: !!runtime?.c,
        modules: lastCacheSize,
        guildStore: !!guildStore,
        names: known.size,
        scannedIcons: detectedIds.length,
        mode: lookupMethod,
        scans,
        error: lastError
      }
    };
    window.postMessage(details, location.origin);
  }
  function scan() {
    scheduled = false;
    scans++;
    const gotStore = findStore();
    if (!gotStore) reactNames();
    if (!gotStore && known.size > 0) lookupMethod = 'React';
    emit();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(scan, 300);
  }
  // Periodic retry handles Discord loading the webpack runtime late.
  window.addEventListener('message', evt => {
    if (evt.source === window && evt.origin === location.origin && evt.data?.source === REQUEST) schedule();
  });
  new MutationObserver(records => {
    if (records.some(r => !r.target.closest?.('#dsn-v7-root'))) schedule();
  }).observe(document, {subtree:true,childList:true}); // document exists even at document_start
  setInterval(scan, 4000);
  schedule();
})();
