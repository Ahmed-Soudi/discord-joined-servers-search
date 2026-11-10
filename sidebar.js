/* Discord Joined Servers Search v7.0.1 — isolated-world UI. */
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
  let expanded = true;
  let query = '';
  let selected = 0;
  let lastRender = '';

  const create = (tag, className, content) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (content !== undefined) n.textContent = content;
    return n;
  };
  const root = create('aside', 'dsn-v7-root');
  root.id = ROOT_ID;
  root.setAttribute('aria-label', 'Search your joined Discord servers');
  const heading = create('header', 'dsn-v7-heading');
  const label = create('strong', '', 'Joined servers · v7');
  const buttons = create('div', 'dsn-v7-buttons');
  const refresh = create('button', 'dsn-v7-icon-button', '↻');
  refresh.type = 'button'; refresh.title = 'Retry name discovery'; refresh.setAttribute('aria-label', 'Retry name discovery');
  const toggle = create('button', 'dsn-v7-icon-button', '−');
  toggle.type = 'button'; toggle.title = 'Collapse server names'; toggle.setAttribute('aria-label', 'Collapse server names');
  buttons.append(refresh,toggle); heading.append(label,buttons);
  const inner = create('div', 'dsn-v7-inner');
  const search = create('input', 'dsn-v7-search');
  search.type = 'search'; search.placeholder = 'Search joined servers…';
  search.setAttribute('aria-label', 'Search joined Discord servers'); search.autocomplete = 'off';
  const count = create('div', 'dsn-v7-count', 'Discovering servers…');
  const detail = create('div', 'dsn-v7-detail', 'Waiting for Discord client data');
  const list = create('div', 'dsn-v7-list'); list.setAttribute('role', 'list');
  const footer = create('div', 'dsn-v7-footer');
  const copy = create('button', 'dsn-v7-copy', 'Copy status'); copy.type = 'button';
  footer.append(copy); inner.append(search,count,detail,list,footer);root.append(heading,inner);

  const mounted = () => { if (document.body && !root.isConnected) document.body.append(root); };
  function detectVisibleIds() {
    const ids=[];const seen=new Set();
    for(const node of document.querySelectorAll('[data-list-item-id^="guildsnav___"]')){
      if (node.closest('#'+ROOT_ID)) continue;
      const id=node.getAttribute('data-list-item-id')?.match(/guildsnav___(\d{15,22})(?:_|$)/)?.[1];
      if(id&&!seen.has(id)){seen.add(id);ids.push(id);}
    }
    return ids;
  }
  function serverList(){
    const combined=[...order,...detectVisibleIds(),...names.keys()];
    const found=[];const seen=new Set();
    for(const id of combined){if(!isId(id)||seen.has(id))continue;seen.add(id);found.push({id,name:names.get(id)||''});}
    return found;
  }
  function render(){
    mounted();
    root.classList.toggle('dsn-v7-disabled',!enabled);
    root.classList.toggle('dsn-v7-collapsed',!expanded);
    toggle.textContent=expanded?'−':'+';
    toggle.setAttribute('aria-label',expanded?'Collapse server names':'Expand server names');
    if(!enabled||!expanded)return;
    const all=serverList();
    const filter=query.toLocaleLowerCase().trim();
    const rows=filter ? all.filter(g=>g.name.toLocaleLowerCase().includes(filter)) : all;
    if (selected>=rows.length)selected=Math.max(0,rows.length-1);
    const countNamed=all.filter(g=>g.name).length;
    const cacheCount=diagnostic?.modules||0;
    const status=pageBridgeSeen ?
      diagnostic?.guildStore ? `GuildStore connected · ${cacheCount} modules` :
      diagnostic?.webpack ? `GuildStore unavailable · ${cacheCount} modules` :
      'Discord webpack runtime not found yet' : 'Page adapter not responding';
    const fingerprint=JSON.stringify([all,query,selected,status,enabled,expanded]);
    if (fingerprint===lastRender)return;
    lastRender=fingerprint;
    count.textContent=`${all.length} joined server${all.length===1?'':'s'} · ${countNamed} named · no channels`;
    detail.textContent=status;
    detail.title=diagnostic?.error||status;
    const frag=document.createDocumentFragment();
    if(!rows.length) frag.append(create('p','dsn-v7-empty',all.length ? 'No matching server names.' : 'Waiting for your server list…'));
    for(const [i,entry] of rows.entries()){
      const link=create('a','dsn-v7-row'+(i===selected?' dsn-v7-selected':''));
      link.href=`/channels/${entry.id}`;
      link.title=entry.name||`Discord server ID ${entry.id}; name not yet available`;
      link.setAttribute('role','listitem');
      const symbol=create('span','dsn-v7-dot','●'); symbol.setAttribute('aria-hidden','true');
      const name=create('span','dsn-v7-name',entry.name||`Name unavailable (${entry.id})`);
      link.append(symbol,name);
      frag.append(link);
    }
    list.replaceChildren(frag);
  }
  function scheduleRender(){
    clearTimeout(timer);
    timer=setTimeout(render,80);
  }
  window.addEventListener('message', event => {
    if (event.source!==window || event.origin!==location.origin || event.data?.source!==DATA) return;
    pageBridgeSeen=true;
    const payload=event.data;
    if(Array.isArray(payload.names))for(const item of payload.names){
      if(item && isId(item.id) && validName(item.name))names.set(item.id,text(item.name));
    }
    if(Array.isArray(payload.order))order=payload.order.filter(isId);
    if(payload.diagnostic && typeof payload.diagnostic==='object'){
      diagnostic={
        webpack:payload.diagnostic.webpack===true,
        modules:Number(payload.diagnostic.modules)||0,
        guildStore:payload.diagnostic.guildStore===true,
        scans:Number(payload.diagnostic.scans)||0,
        error:text(payload.diagnostic.error).slice(0,150)
      };
    }
    scheduleRender();
  });
  search.addEventListener('input',()=>{query=search.value;selected=0;lastRender='';render();});
  search.addEventListener('keydown',event=>{
    const rows=serverList().filter(g=>g.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault(); selected=rows.length?(selected+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length:0;lastRender='';render();
    } else if(event.key==='Enter'){event.preventDefault();list.querySelector('.dsn-v7-selected')?.click();}
    else if(event.key==='Escape'){query='';search.value='';selected=0;lastRender='';render();}
  });
  toggle.addEventListener('click',()=>{
    expanded=!expanded;chrome.storage.local.set({expanded});lastRender='';render();
  });
  refresh.addEventListener('click',()=>{
    window.postMessage({source:REQUEST},location.origin);
    detail.textContent='Retrying name discovery…';
  });
  copy.addEventListener('click',()=>{
    const all=serverList();
    const report=`Discord Joined Servers Search v7.0.1\nJoined servers: ${all.length}\nNamed: ${all.filter(x=>x.name).length}\nPage adapter: ${pageBridgeSeen?'connected':'not responding'}\nWebpack: ${diagnostic?.webpack?'found':'not detected'}\nModules: ${diagnostic?.modules??'unknown'}\nGuildStore: ${diagnostic?.guildStore?'found':'not found'}\nScans: ${diagnostic?.scans??0}\nError: ${diagnostic?.error||'none'}`;
    navigator.clipboard?.writeText(report).then(()=>{copy.textContent='Copied!';setTimeout(()=>copy.textContent='Copy status',1700);})
      .catch(()=>{copy.textContent='Copy failed';});
  });
  chrome.storage.local.get({enabled:true,expanded:true},prefs=>{
    enabled=prefs.enabled;expanded=prefs.expanded;lastRender='';render();
  });
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes.enabled)enabled=changes.enabled.newValue;
    if(changes.expanded)expanded=changes.expanded.newValue;
    lastRender='';render();
  });
  new MutationObserver(records=>{
    if(records.every(r=>r.target.closest?.('#'+ROOT_ID)))return;
    scheduleRender();
  }).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('popstate',scheduleRender);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleRender();window.postMessage({source:REQUEST},location.origin);}});
  render();
  window.postMessage({source:REQUEST},location.origin);
})();
