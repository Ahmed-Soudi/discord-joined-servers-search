"""Browser-level test with a mocked Discord webpack runtime. No Discord login."""
import asyncio
import html
import json
import tempfile
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

EXT = Path(__file__).resolve().parents[1]
IDS = [str(130000000000000000 + i) for i in range(86)]
GUILDS = {guild_id: {'id': guild_id, 'name': ('Mortal Kombat' if i == 0 else f'Test Server {i:02}')} for i, guild_id in enumerate(IDS)}


def fake_discord(name_source='getGuilds'):
    rows = ''.join(f'<div data-list-item-id="guildsnav___{id}" role="treeitem"><a href="/channels/{id}"><img alt="" width="35"></a></div>' for id in IDS)
    is_late = name_source == 'lateGuildStore'
    lookup = 'getGuilds' if is_late else name_source
    store = {
        'getGuilds': f'getGuilds() {{ return GUILDS; }}, getGuild() {{ return null; }}',
        'getGuildsArray': f'getGuildsArray() {{ return Object.values(GUILDS); }}, getGuild() {{ return null; }}',
        'getGuildIds': f'getGuildIds() {{ return Object.keys(GUILDS); }}, getGuild(id) {{ return GUILDS[id]; }}',
        'react': ''
    }[lookup]
    runtime = '' if lookup == 'react' else f'''
       {'setTimeout(() => {' if is_late else ''}
       const store = {{ {store} }};
       const requireFn = {{ c: {{ 111: {{ exports: {{ Q: {{ Z: store }} }} }} }} }};
       const chunk = [];
       chunk.push = function(payload) {{ Array.prototype.push.call(this,payload); if(typeof payload[2]==='function')payload[2](requireFn); return this.length; }};
       window.webpackChunkdiscord_app = chunk;
       {'}, 1200);' if is_late else ''}
    '''
    fiber = '' if name_source != 'react' else '''
       for(const el of document.querySelectorAll('[data-list-item-id^="guildsnav___"]')){
         const id=el.getAttribute('data-list-item-id').slice('guildsnav___'.length);
         el['__reactProps$mock']={guild:GUILDS[id]};
       }
    '''
    return f'''<!doctype html><html><head><meta charset="utf-8"></head><body>
      <div id="root"><div data-list-id="guildsnav" style="width:72px">{rows}</div><section>Test Discord page</section></div>
      <script>
      const GUILDS = {json.dumps(GUILDS)};
      {runtime}
      {fiber}
      </script>
      </body></html>'''

async def run_case(browser, mode):
    context = await browser.new_context()
    try:
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        await page.set_content(fake_discord(mode),wait_until='load')
        # Environment blocks browser navigation, so run page-bridge and sidebar
        # scripts directly against a simulated Discord document in Chromium.
        await page.evaluate("""() => {
          const listeners = [];
          const memory = {enabled:true, expanded:true};
          window.chrome = {storage:{local:{
            get(defaults, callback){ callback({...defaults,...memory}); },
            set(values){ Object.assign(memory,values); },
          },onChanged:{ addListener(){} }}};
          window.postMessage = (data, origin) => {setTimeout(() => {
            window.dispatchEvent(new MessageEvent('message', {data,origin:location.origin,source:window}));
          },0);};
        }""")
        await page.add_script_tag(path=str(EXT/'page-bridge.js'))
        await page.add_script_tag(path=str(EXT/'sidebar.js'))
        await page.locator('#dsn-v7-root').wait_for(timeout=12000)
        try:
            await page.wait_for_function("document.querySelector('#dsn-v7-root .dsn-v7-count')?.textContent.includes('86 named')",timeout=8000)
        except Exception:
            print('Diagnostics:',await page.locator('.dsn-v7-count').inner_text(),await page.locator('.dsn-v7-detail').inner_text())
            print('Errors:', errors)
            raise
        count = await page.locator('.dsn-v7-count').inner_text()
        assert '86 joined servers · 86 named' in count, (mode,count)
        assert await page.locator('.dsn-v7-row').count() == 86
        assert 'Mortal Kombat' in await page.locator('.dsn-v7-row').first.inner_text()
        await page.locator('.dsn-v7-search').fill('Mortal')
        assert await page.locator('.dsn-v7-row').count() == 1
        assert await page.locator('.dsn-v7-row').first.get_attribute('href') == '/channels/'+IDS[0]
        assert not errors, errors
        print(f'PASS [{mode}]: 86 named, no channels, exact server search, correct link')
    finally:
        await context.close()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        try:
            for mode in ['getGuilds','getGuildsArray','getGuildIds','react','lateGuildStore']:
                await run_case(browser,mode)
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
