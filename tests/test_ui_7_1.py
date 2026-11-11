"""Simulated Chromium tests: GuildStore name discovery and new floating UI."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

EXT = Path(__file__).resolve().parents[1]
IDS = [str(130000000000000000 + i) for i in range(86)]
GUILDS = {id: {'id': id, 'name': f'Test Server {i:02d}'} for i, id in enumerate(IDS)}


def fake_html():
    rail = ''.join(f'<div data-list-item-id="guildsnav___{id}"><a href="/channels/{id}">ICON</a></div>' for id in IDS)
    return f'''<!doctype html><html><head></head><body><nav>{rail}</nav><script>
      const GUILDS = {json.dumps(GUILDS)};
      const store = {{ getGuilds() {{return GUILDS;}},getGuild(id){{return GUILDS[id]}} }};
      const requireFn = {{c: {{ 12: {{exports: {{ Z: {{Z: store}} }} }} }} }};
      const chunks=[];
      chunks.push = function(payload){{Array.prototype.push.call(this,payload);if(typeof payload[2]==='function')payload[2](requireFn);return this.length;}};
      window.webpackChunkdiscord_app=chunks;
      </script></body></html>'''


async def setup(browser, stored=None, viewport=None):
    context = await browser.new_context(viewport=viewport or {'width':1366,'height':768})
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.set_content(fake_html())
    await page.evaluate('''(stored) => {
      window.__memory = {...stored};
      window.chrome = {storage:{local:{
        get(defaults,callback){callback({...defaults,...window.__memory});},
        set(values){ Object.assign(window.__memory,values);window.__changes?.({...values}); },
        remove(key,callback){delete window.__memory[key];window.__changes?.({[key]:undefined});callback?.();}
      },onChanged:{addListener(listener){window.__changes=(values)=>{
        let diffs={};for(let key in values)diffs[key]={newValue:values[key]};listener(diffs,'local');
      };}}}};
      window.postMessage=(data,origin)=>{
        setTimeout(()=>window.dispatchEvent(new MessageEvent('message',{data,origin:location.origin,source:window})),0);
      };
    }''', stored or {})
    await page.add_style_tag(path=str(EXT / 'sidebar.css'))
    await page.add_script_tag(path=str(EXT / 'page-bridge.js'))
    await page.add_script_tag(path=str(EXT / 'sidebar.js'))
    await page.wait_for_function("document.querySelector('#dsn-v7-root .dsn-v7-count')?.textContent.includes('86 named')",timeout=10000)
    return context,page,errors

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        try:
            context,page,errors=await setup(browser)
            root=page.locator('#dsn-v7-root')
            assert await page.locator('.dsn-v7-panel').is_hidden(), 'must start as search bar'
            assert await page.locator('.dsn-v7-search').is_visible()
            assert await page.locator('.dsn-v7-title').inner_text()=='Joined Servers Search'
            assert await root.get_attribute('class')=='dsn-v7-root'
            box=await root.bounding_box(); assert abs(box['x']-76)<3 and abs(box['y']-0)<3,box
            print('PASS: search-only default in top strip at 76,0, no version in title')

            await page.locator('.dsn-v7-search').fill('Test Server 35')
            assert await page.locator('.dsn-v7-row').count()==1
            assert await page.locator('.dsn-v7-row').first.get_attribute('href')=='/channels/'+IDS[35]
            await page.locator('.dsn-v7-search').fill('')
            assert await page.locator('.dsn-v7-panel').is_hidden()
            print('PASS: typeahead search exposes filtered matching server, closes on clear')

            grip=page.locator('.dsn-v7-grip')
            g=await grip.bounding_box()
            x=g['x']+g['width']/2;y=g['y']+g['height']/2
            await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+245,y+170,steps=10);await page.mouse.up()
            box=await root.bounding_box()
            assert abs(box['x']-321)<8 and abs(box['y']-170)<8,box
            stored=await page.evaluate('window.__memory')
            assert abs(stored['panelPosition']['left']-321)<8,stored
            assert abs(stored['panelPosition']['top']-170)<8,stored
            print('PASS: pointer drag moves window and stores pixel position')
            assert not errors,errors
            await context.close()

            context2,page2,errors2=await setup(browser,stored=stored)
            root2=page2.locator('#dsn-v7-root')
            box2=await root2.bounding_box()
            assert abs(box2['x']-321)<8 and abs(box2['y']-170)<8,box2
            assert await page2.locator('.dsn-v7-panel').is_hidden()
            await page2.locator('.dsn-v7-toggle').click()
            assert await page2.locator('.dsn-v7-row').count()==86
            assert await page2.locator('.dsn-v7-panel').is_visible()
            assert await page2.evaluate('window.__memory.showListByDefault') is True
            await page2.locator('.dsn-v7-toggle').click()
            assert await page2.locator('.dsn-v7-panel').is_hidden()
            assert await page2.evaluate('window.__memory.showListByDefault') is False
            print('PASS: persisted position survives reload and default-full-list toggle saves')
            assert not errors2,errors2
            await context2.close()

            context3,page3,errors3=await setup(browser,{'enabled':True,'showListByDefault':True})
            root3=page3.locator('#dsn-v7-root')
            rect3=await root3.bounding_box()
            assert abs(rect3['x']-76)<3 and abs(rect3['y']-75)<3,rect3
            assert await page3.locator('.dsn-v7-row').count()==86
            assert await page3.locator('.dsn-v7-panel').is_visible()
            await page3.set_viewport_size({'width':320,'height':260})
            await page3.wait_for_timeout(100)
            rect3=await root3.bounding_box()
            assert rect3['x']>=0 and rect3['x']+rect3['width']<=320
            assert rect3['y']>=0 and rect3['y']+rect3['height']<=260,rect3
            print('PASS: default full-list starts at previous 76,75 and stays within small viewport')
            assert not errors3,errors3
            await context3.close()
            print('ALL TESTS PASSED')
        finally:
            await browser.close()

if __name__=='__main__':
    asyncio.run(main())
