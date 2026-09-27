"""Languages: the page in English has no Bosnian/Serbian text left (start screen, settings, how-to, a game with its sheets,
every era), and the Serbian switch (localStorage ra_lang = 'sr') shows Serbian Latin (Istorija, not Historija).
python3 build/test_lang.py [era ...]"""
import asyncio, sys, os, re
from playwright.async_api import async_playwright
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
LEAF = open(R + 'package/dist/leaflet.js').read()
ERAS = sys.argv[1:] or ['danas', 'rim', 'ww2']
fails = []
# words that are only Bosnian/Serbian (English text never has them); letters with diacritics are checked separately
BS = set('je nije nisi ima nema igra igre igru igrač igrača država države državu grad grada gradova vojska vojske vojsku zlato zlata '
         'kopno kopna savez saveza rat rata mir mira napad napadi napada zemlja zemlje zemlju tvoj tvoja tvoje moj moja '
         'ili ali kad dok još već sve svi samo više manje nivo tim tima pobjeda poraz uključeno isključeno dozvoljeno '
         'zabranjeno odustani nastavi pauza meni nazad zatvori otvori brzina karta karte mapa doba godina sekundi minuta '
         'dana dan sati jedinice jedinica rakete raketa gradnja gradi luka brod brodovi desant savezi diplomatija ekonomija '
         'istraživanje stablo tehnologija resursi trgovina porez kamata zajam vazal danak odbrana napadni zauzmi preuzmi '
         'kompjuter računar lako srednje teško bez za od na se da ne ti mi vi oni nas vas operacija dinastija komandant '
         'komandanta profil svijet svijeta evropa evrope historija istorija'.split())


NAMES = set()  # proper names (rulers, places, the default dynasty) may keep their letters


def bosnian(text):
    hits = set()
    for w in re.findall(r"[A-Za-zÀ-žČĆŽŠĐčćžšđ]+", text):
        if (re.search('[čćžšđČĆŽŠĐ]', w) and w not in NAMES) or (w.lower() in BS and not w.isupper() and w not in ('Dan', 'Mira', 'Nora', 'Ana', 'Rim')):
            hits.add(w)
    return hits


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1400, 'height': 900})
        page = await ctx.new_page()
        page.set_default_timeout(90_000)
        errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))

        async def route(r):
            u = r.request.url
            if 'leaflet' in u and u.endswith('.js'):
                await r.fulfill(status=200, content_type='application/javascript', body=LEAF)
            elif u.startswith('file://'):
                await r.continue_()
            else:
                await r.abort()
        await page.route('**/*', route)
        await page.goto('file://' + R + 'dist/test.html')
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
        ev = page.evaluate
        NAMES.update((await ev('() => [...RA.RULER_SURNAMES, ...Object.values(RA.RULER_NAMES).flatMap(o => [...o.m, ...o.f]), ...Object.values(RA.EN_NAMES), "Kotromanić", "Košice", "Niš", "Peć"].join(" ")')).split())
        seen = {}

        async def scan(where):
            t = await ev('() => document.body.innerText + " " + [...document.querySelectorAll("[title],[aria-label],[placeholder]")].map(e => [e.title, e.getAttribute("aria-label"), e.placeholder].join(" ")).join(" ")')
            for h in bosnian(t):
                seen.setdefault(h, where)

        await scan('start screen')
        await page.click('#howBtn')
        await page.wait_for_timeout(400)
        await scan('how to play')
        await ev('window.__ra.ui.closeSheet()')
        for pace in ['focus', 'custom', 'blitz']:
            await page.click(f'#paceSeg button[data-v="{pace}"]')
            await ev('() => document.getElementById("operationDialog").open || document.getElementById("configBtn").click()')
            await page.wait_for_timeout(300)
            await scan('settings: ' + pace)
            await ev('() => document.getElementById("configDone").click()')
            await page.wait_for_timeout(200)
        await page.click('#campBigBtn')
        await page.wait_for_timeout(400)
        await scan('campaign')
        b2 = await ev('() => { const b = document.querySelector("#sheet [data-home]"); if (b) b.click(); return !!b; }')
        await page.wait_for_timeout(400)
        await scan('campaign dynasty')
        await ev('() => window.__ra.ui.closeSheet()')
        for era in ERAS:
            await ev('() => window.__ra.showStart && window.__ra.showStart()')
            await page.wait_for_timeout(300)
            await page.click(f'#eraSeg button[data-v="{era}"]')
            await page.wait_for_timeout(300)
            await scan('start ' + era)
            await ev('() => { const s = window.__ra.ui.settings; s.pace = "custom"; s.tree = true; s.res = true; }')
            await page.click('#goBtn')
            await page.wait_for_timeout(900)
            await scan('spawn ' + era)
            pid = await ev('() => window.__ra.G.P.find(p => p && p.type === "nation").id')
            await page.select_option('#natSel', str(pid))
            await page.wait_for_timeout(300)
            await page.click('#startBtn')
            await ev('() => { const G = window.__ra.G; for (let i = 0; i < 900; i++) G.step(); G.me.gold += 5e6; }')
            await page.wait_for_timeout(600)
            await scan('game ' + era)
            for sh in ['econSheet', 'armySheet', 'buildSheet', 'diploSheet', 'landSheet', 'strikeSheet', 'stanceSheet', 'quickSheet', 'intelSheet', 'menu', 'howTo']:
                ok = await ev(f'() => {{ try {{ window.__ra.ui.{sh}(); return true; }} catch (e) {{ return String(e); }} }}')
                await page.wait_for_timeout(250)
                await scan(f'{sh} {era}')
                await ev('() => window.__ra.ui.closeSheet()')
            # the country sheet of another state and the end screen
            await ev('() => { const G = window.__ra.G, o = G.P.find(p => p && p.alive && p !== G.me && p.type === "nation"); if (o) window.__ra.ui.cellSheet(o.capital); }')
            await page.wait_for_timeout(250)
            await scan('nation sheet ' + era)
            await ev('() => window.__ra.ui.closeSheet()')
            evs = await ev('() => window.__ra.G.events.map(e => e.text).join(" ")')
            for h in bosnian(evs):
                seen.setdefault(h, 'events ' + era)
            await ev('() => window.__ra.ui.dealSheet(window.__ra.G.P.find(p => p && p.alive && p !== window.__ra.G.me && p.type === "nation").id)')
            await page.wait_for_timeout(250)
            await scan('deal sheet ' + era)
            await ev('() => { window.__ra.ui.closeSheet(); window.__ra.ui.showEnd("win"); }')
            await page.wait_for_timeout(400)
            await scan('end screen ' + era)
        check(not seen, 'English: no Bosnian/Serbian words ' + ', '.join(f'{k} ({v})' for k, v in list(seen.items())[:40]))
        # Serbian
        await ev('() => localStorage.setItem("ra_lang", "sr")')
        await page.reload()
        await page.wait_for_function('document.getElementById("loading").hidden', timeout=60000)
        t = (await ev('() => document.body.innerText')).lower()
        check('započni osvajanje' in t and 'kampanja' in t, 'Serbian: the start screen is in Serbian')
        check('historij' not in t and 'istorija' in t, 'Serbian Latin: Istorija, not Historija')
        await page.click('#howBtn')
        await page.wait_for_timeout(300)
        t = await ev('() => document.getElementById("sheet").innerText')
        check('Cilj' in t, 'Serbian: how to play')
        await ev('() => localStorage.removeItem("ra_lang")')
        check(not errs, 'no page errors ' + ' | '.join(errs[:3]))
        await b.close()
    print('FAILS:', fails or 'none')
    sys.exit(1 if fails else 0)

asyncio.run(main())
