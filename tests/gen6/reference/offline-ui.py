import re,json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='chrome')
    for width,height in [(360,740),(390,844),(1024,600),(1366,768)]:
        ctx=browser.new_context(viewport=dict(width=width,height=height))
        page=ctx.new_page()
        page.set_default_timeout(4500)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4176/')
        btn=lambda title:page.get_by_role('button',name=title,exact=isinstance(title,str))
        btn(re.compile('^it$',re.I)).click()
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        page.evaluate("""localStorage.setItem('gen6_rng_profiles_v1',JSON.stringify({generation:6,version:1,activeProfileId:'test',profiles:[{id:'test',name:'QA',gameVersion:'X',tid:0,sid:0,shinyCharm:true}]}))""")
        ctx.set_offline(True)
        btn(re.compile('Generation 6')).click()
        def nav(name,secondary=False):
            if secondary and width<1024:btn('More').click()
            btn(name).filter(visible=True).click()
        def search(first=True):
            btn('Search').click()
            expect(page.get_by_role('status').filter(has_text=re.compile(r'\d+ results'))).to_be_visible()
            if first:
                btn(re.compile(r'^#0\b')).click()
                expect(page.get_by_role('dialog')).to_be_visible()
                page.keyboard.press('Escape')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.get_by_label('MT seed (hex)').fill('35B19AF2')
        btn('Apply').click()
        def compare(name):
            rows=json.loads(Path('tests/gen6/'+name+'-desktop.json').read_text(encoding='utf8'))
            for row in rows:
                if row['Frame']=='-1':continue
                btn(re.compile('^#'+row['Frame']+r'\b')).click()
                dialog=page.get_by_role('dialog')
                expect(dialog).to_contain_text(row['PID'])
                expect(dialog).to_contain_text(row['EC'])
                page.keyboard.press('Escape')
        nav('Wild')
        page.get_by_label('Max Frame',exact=True).fill('9')
        methods=page.get_by_label('Method',exact=True)
        for value in methods.locator('option').evaluate_all('opts=>opts.map(o=>o.value)'):
            methods.select_option(value)
            search()
            if value=='Normal':compare('wild')
        nav('Egg')
        search()
        compare('egg')
        nav('Event',True)

        page.get_by_label(re.compile('^Ability')).select_option('0')
        page.get_by_label(re.compile('^Gender')).select_option('0')
        search()
        compare('event')
        nav('Tools',True)
        page.get_by_label('Max Frame',exact=True).fill('21204')
        page.get_by_label('Min Frame',exact=True).fill('21202')
        search(False)
        btn(re.compile('^#21203')).click()
        expect(page.get_by_role('dialog')).to_contain_text('Strain 3')
        page.keyboard.press('Escape')
        nav('Seed')
        btn('MT Seed Finder').click()
        page.get_by_label('Seed min (hex)').fill('35B19AE0')
        page.get_by_label('Seed max (hex)').fill('35B19B00')
        page.get_by_label(re.compile('^Nature')).select_option('3')
        for stat,value in zip(['HP','Atk','Def','SpA','SpD','Spe'],[31,1,5,5,2,27]):
            for bound in ['min','max']:
                page.get_by_label(stat+' '+bound,exact=True).fill(str(value))
        for count in [1,2,4]:
            page.get_by_label(re.compile('^Worker')).select_option(str(count))
            search(False)
            expect(page.get_by_text(re.compile('33 seed · '+str(count)+' worker'))).to_be_visible()
            expect(page.get_by_text('#2 · Adamant · 65',exact=True)).to_be_visible()
        btn('Apply seed').click()
        expect(page.get_by_label('MT seed (hex)')).to_have_value('35B19AF2')
        btn('TinyMT Timeline').click()
        for index,word in enumerate(['11223344','55667788','99AABBCC','DDEEFF00']):
            page.get_by_label('S'+str(3-index),exact=True).fill(word)
        search(False)
        btn(re.compile(r'^#0\b')).first.click()
        expect(page.get_by_role('dialog')).to_contain_text('11223344')
        page.keyboard.press('Escape')
        page.reload()
        assert not errors, errors
        print(width,'offline UI verified',flush=True)
        ctx.close()
    browser.close()

