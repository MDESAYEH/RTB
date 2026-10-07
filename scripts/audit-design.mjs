import {chromium} from '@playwright/test';import fs from 'node:fs';
const base='http://127.0.0.1:3000',out='verification/design-rebuild';const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
fs.writeFileSync(out+'/tournament-before.json',await(await fetch(base+'/api/data')).text());
const clubs=JSON.parse(fs.readFileSync('lib/team-identity.json','utf8')).teams;
const results=[];for(const path of ['/', '/teams', '/matches', '/standings', '/stats', '/the-road', '/news', ...clubs.map(t=>'/teams/'+t.slug)]){
await page.goto(base+path,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
for(const width of [360,390,430,768,1024,1440,1920]){await page.setViewportSize({width,height:900});const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,nested:document.querySelectorAll('a a').length,badVisibleImages:[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&i.complete&&i.naturalWidth===0}).map(i=>i.src)}));results.push({path,width,...result});}
}
fs.writeFileSync(out+'/responsive.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({checks:results.length,failures:results.filter(r=>r.overflow||r.nested||r.badVisibleImages.length),errors},null,2));
await browser.close();
