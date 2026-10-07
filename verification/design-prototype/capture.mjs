import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({headless:true});
const results=[];
for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];page.on('pageerror',err=>errors.push(err.message));
 for(const view of ['hero','road','game']){
  await page.goto(`http://127.0.0.1:3030/?view=${view}`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`${root}${view}-${size}.png`});
  const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,missingImages:[...document.images].filter(i=>i.closest('.active')&&(!i.complete||!i.naturalWidth)).length,h1:[...document.querySelectorAll('.view.active h1')].map(x=>x.textContent),networkEntries:performance.getEntriesByType('resource').map(e=>e.name)}));
  results.push({view,size,...metrics,errors:[...errors]});
 }
 await page.emulateMedia({reducedMotion:'reduce'});results.push({size,reducedMotion:await page.locator('.live i').evaluate(e=>getComputedStyle(e).animationName)});await page.close();
}
await browser.close();await fs.writeFile(`${root}review.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({networkEntries:_networkEntries,...r})=>r),null,2));


